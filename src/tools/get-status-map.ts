// src/tools/get-status-map.ts
//
// ── 为什么这个工具存在？ ──────────────────────────────────────────────
//
// Linear 的工作流状态（workflow states）是团队级别的概念：
// 每个团队可以自定义状态名称和顺序（如 "Backlog"、"In Progress"、"Done" 等）。
//
// 当 skill 需要"把 HAT-155 移到 In Progress 状态"时，
// Linear API 要求提供状态的 UUID（如 "b1c2d3e4-..."），而不是名称字符串。
//
// 这个工具的职责就是：给定团队标识，返回"状态名称 → UUID"的映射表，
// 让 skills 可以用人类可读的名称操作状态，而不需要记忆 UUID。
//
// ── GraphQL 查询结构说明 ──────────────────────────────────────────────
//
// Linear 的 workflowStates 接口支持按团队过滤：
//   workflowStates(filter: { team: { id: { eq: $teamId } } })
//
// 返回的每个状态包含：
//   - id：UUID，用于 issueUpdate mutation
//   - name：显示名称，如 "In Progress"（每个团队可自定义）
//   - type：系统级分类（backlog/unstarted/started/completed/canceled），
//           type 不随名称变化，是程序判断状态语义的可靠依据
//
// ── Team Key vs UUID 的处理 ───────────────────────────────────────────
//
// 用户记住的通常是 team key（如 "HAT"，短、易读），
// 而 API 需要的是 team UUID（如 "cac83401-25ca-461e-aec8-e9cb7a16caef"）。
//
// 判断策略：如果输入不含横线且长度 <= 10，视为 key，先做解析；
// 否则直接当 UUID 使用。这个启发式规则覆盖了所有实际场景
//（team key 从来不超过 10 字符，UUID 必然包含横线）。
//
// ── 返回值格式 ────────────────────────────────────────────────────────
//
// 返回 StatusMapResult，包含两个字段：
//   - map：每个状态的 "名称 → UUID" 映射（如 { "In Progress": "xxx-yyy" }）
//           供 issueUpdate 等操作直接使用
//   - all：团队所有状态的完整列表（含 type 信息），供需要精确匹配的场景使用
//
// 例：
// {
//   map: { "Backlog": "uuid-1", "In Progress": "uuid-2", "Done": "uuid-3" },
//   all: [
//     { id: "uuid-1", name: "Backlog", type: "backlog" },
//     { id: "uuid-2", name: "In Progress", type: "started" },
//     ...
//   ]
// }

import type { GraphQLFn } from "../graphql.js";
import type { StatusMapResult } from "../types.js";

// ── 原始 GraphQL 响应类型（内部用）────────────────────────────────────

interface RawWorkflowState {
  id: string;
  name: string;
  type: string;
}

// ── 主函数 ────────────────────────────────────────────────────────────

export async function getStatusMap(
  args: { team: string },
  graphql: GraphQLFn
): Promise<StatusMapResult> {
  const teamId = await resolveTeamId(args.team, graphql);
  return fetchStatusMap(teamId, graphql);
}

// ── Team Key 解析 ─────────────────────────────────────────────────────
//
// 如果输入是 team key（短字符串，无横线），先查所有 teams 找到对应 UUID。
// 否则直接返回输入（认为已经是 UUID）。

async function resolveTeamId(input: string, graphql: GraphQLFn): Promise<string> {
  // 启发式判断：UUID 格式一定包含横线且长度 > 10；key 不含横线且长度 <= 10
  const looksLikeKey = !input.includes("-") && input.length <= 10;

  if (!looksLikeKey) {
    // 已经是 UUID，直接返回
    return input;
  }

  // 是 team key，查询所有 teams 找到对应 UUID
  const data = await graphql<{ teams?: { nodes: Array<{ id: string; key: string }> } }>(`
    query {
      teams {
        nodes { id key }
      }
    }
  `);

  const teams = data.teams?.nodes ?? [];
  // key 不区分大小写匹配（Linear 的 key 一般全大写，但容错处理）
  const match = teams.find(
    (t) => t.key.toLowerCase() === input.toLowerCase()
  );

  if (!match) {
    throw new Error(
      `Team key "${input}" not found. Available keys: ${teams.map((t) => t.key).join(", ")}`
    );
  }

  return match.id;
}

// ── 状态查询与映射 ────────────────────────────────────────────────────

async function fetchStatusMap(teamId: string, graphql: GraphQLFn): Promise<StatusMapResult> {
  const data = await graphql<{ workflowStates?: { nodes: RawWorkflowState[] } }>(
    `
    query GetStatuses($teamId: ID!) {
      workflowStates(filter: { team: { id: { eq: $teamId } } }) {
        nodes { id name type }
      }
    }
    `,
    { teamId }
  );

  const nodes = data.workflowStates?.nodes ?? [];

  if (nodes.length === 0) {
    throw new Error(`No workflow states found for team ID: ${teamId}`);
  }

  // 构建 "状态名称 → UUID" 映射
  // 这是最常用的形式：skill 用名称查 UUID，再用 UUID 调用 issueUpdate
  const map: Record<string, string> = {};
  for (const node of nodes) {
    map[node.name] = node.id;
  }

  // 返回结构化结果：map 用于常规操作，all 用于需要 type 信息的场景
  // 不再使用 "_all" 字符串 key hack，而是用独立的 all 字段
  return { map, all: nodes };
}
