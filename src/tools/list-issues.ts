// src/tools/list-issues.ts
//
// ── 为什么这个工具存在？ ──────────────────────────────────────────────
//
// skills 经常需要"给我看 Ghost-in-the-Shell 项目里未完成的 issues"
// 或"给我看分配给我的高优先级 issues"这类查询。
//
// 旧系统（hat-linear-ops）的 list-issues 只支持有限的过滤条件（project/team/assignee/limit），
// 本工具扩展了更多维度：state、parentId、priority、全文搜索，
// 覆盖 skills 日常使用的所有场景。
//
// 返回格式是 CompactListItem（比 CompactIssue 更精简），
// 不含 description/comments 等大字段——列表场景不需要那些，
// 只需要足够的信息来决定"要不要点进去看详情"。
//
// ── 动态 GraphQL Filter 构建 ──────────────────────────────────────────
//
// Linear 的 GraphQL filter 语法是声明式的嵌套对象，
// 和 SQL WHERE 子句类似但结构完全不同。
//
// 例如按项目过滤：
//   filter: { project: { name: { eq: "Ghost-in-the-Shell" } } }
//
// 我们不能"拼接字符串"来构建 filter（容易出错且不安全），
// 而是将每个过滤条件表示为 GraphQL filter 片段 + 变量名，
// 最终组合成完整的 GraphQL 查询。
//
// ── "me" 的处理 ───────────────────────────────────────────────────────
//
// 当 assignee="me" 时，需要先查 `viewer { id }` 获取当前 API key 对应的用户 UUID，
// 再用这个 UUID 过滤。
// 这是因为 Linear API 的 filter 只接受 UUID，不接受 "me" 这个魔法字符串。
// 但对工具调用者来说，传 "me" 比传 UUID 自然得多。
//
// ── state 过滤的灵活处理 ─────────────────────────────────────────────
//
// Linear 的 state 有两个维度：
//   - type：started / completed / canceled / backlog / unstarted（程序级分类）
//   - name：In Progress / Done / Canceled 等（用户自定义的具体名称）
//
// 本工具的 state 参数同时支持两种匹配，优先按 type 匹配。
// 例如 state="started" 会匹配所有 type=started 的状态（无论叫什么名字），
// state="In Progress" 会精确匹配名称。
//
// ── 响应转换 ─────────────────────────────────────────────────────────
//
// GraphQL 返回的 parent 是对象 { id: "xxx" }，
// 但 CompactListItem 只需要 parentId: string（扁平化）。
// 转换时直接取 parent.id，parent 为 null 时设为 null。

import type { GraphQLFn } from "../graphql.js";
import type { CompactListItem } from "../types.js";

// ── 参数类型 ──────────────────────────────────────────────────────────

export interface ListIssuesArgs {
  project?: string;     // 按项目名称过滤（精确匹配）
  assignee?: string;    // "me" | UUID | "null"（字符串 "null" 表示无 assignee；不支持直接传 email）
  state?: string;       // state type（"started"）或 state name（"In Progress"）
  parentId?: string;    // 按父 issue UUID 过滤（获取子 issues）
  priority?: number;    // 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
  query?: string;       // 全文搜索（搜索 title + description）
  limit?: number;       // 默认 25，最大 50
}

// ── 原始 GraphQL 响应类型（内部用）────────────────────────────────────

interface RawListItem {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  priorityLabel: string;
  state: { name: string; type: string };
  assignee: { displayName: string } | null;
  parent: { id: string } | null;
}

// GraphQL filter 片段构建结果
interface FilterPart {
  // GraphQL filter 字段片段，如 `project: { name: { eq: $projectName } }`
  fragment: string;
  // 变量名，如 "$projectName: String!"
  varDef: string;
  // 变量值，如 { projectName: "Ghost-in-the-Shell" }
  varValue: Record<string, unknown>;
}

// ── 状态类型枚举（Linear API 定义的 type 值）─────────────────────────

const STATE_TYPES = new Set(["backlog", "unstarted", "started", "completed", "canceled"]);

// ── 主函数 ────────────────────────────────────────────────────────────

export async function listIssues(
  args: ListIssuesArgs,
  graphql: GraphQLFn
): Promise<CompactListItem[]> {
  const limit = Math.min(args.limit ?? 25, 50);
  const filterParts: FilterPart[] = [];

  // ── 1. 处理 assignee 过滤 ──────────────────────────────────────────

  if (args.assignee === "me") {
    // 先查当前 API key 对应的用户 ID，再用 UUID 过滤
    // 这是 Linear API 的限制：filter 只接受 UUID，不接受 "me" 关键字
    const viewerData = await graphql<{ viewer?: { id: string } }>("query { viewer { id } }");
    const meId = viewerData.viewer?.id;
    if (!meId) {
      throw new Error('Failed to resolve current user for assignee="me". Check API key permissions.');
    }
    filterParts.push({
      fragment: "assignee: { id: { eq: $assigneeId } }",
      varDef: "$assigneeId: ID",
      varValue: { assigneeId: meId },
    });
  } else if (args.assignee === "null") {
    // 字符串 "null" 表示"筛选未分配的 issues"
    // Linear 的 null filter 语法是 { null: true }，没有对应变量
    filterParts.push({
      fragment: "assignee: { null: true }",
      varDef: "",
      varValue: {},
    });
  } else if (args.assignee) {
    // 直接传 email 或 UUID
    filterParts.push({
      fragment: "assignee: { id: { eq: $assigneeId } }",
      varDef: "$assigneeId: ID",
      varValue: { assigneeId: args.assignee },
    });
  }

  // ── 2. 处理 project 过滤 ─────────────────────────────────────────

  if (args.project) {
    filterParts.push({
      fragment: "project: { name: { eq: $projectName } }",
      varDef: "$projectName: String!",
      varValue: { projectName: args.project },
    });
  }

  // ── 3. 处理 state 过滤 ───────────────────────────────────────────
  //
  // 判断是 type 还是 name：
  //   - 如果是已知的 type 值（backlog/unstarted/started/completed/canceled），用 type 匹配
  //   - 否则，按 name 精确匹配（用户自定义的状态名如 "In Progress"）

  if (args.state) {
    if (STATE_TYPES.has(args.state.toLowerCase())) {
      filterParts.push({
        fragment: "state: { type: { eq: $stateType } }",
        varDef: "$stateType: String!",
        varValue: { stateType: args.state.toLowerCase() },
      });
    } else {
      filterParts.push({
        fragment: "state: { name: { eq: $stateName } }",
        varDef: "$stateName: String!",
        varValue: { stateName: args.state },
      });
    }
  }

  // ── 4. 处理 parentId 过滤 ────────────────────────────────────────

  if (args.parentId) {
    filterParts.push({
      fragment: "parent: { id: { eq: $parentId } }",
      varDef: "$parentId: ID!",
      varValue: { parentId: args.parentId },
    });
  }

  // ── 5. 处理 priority 过滤 ────────────────────────────────────────

  if (args.priority !== undefined) {
    filterParts.push({
      fragment: "priority: { eq: $priority }",
      varDef: "$priority: Int!",
      varValue: { priority: args.priority },
    });
  }

  // ── 6. 组装 GraphQL 查询 ─────────────────────────────────────────

  // 收集所有变量定义（去掉空字符串）
  const varDefs = ["$limit: Int!", ...filterParts.map((p) => p.varDef).filter(Boolean)];
  // 合并所有变量值
  const variables: Record<string, unknown> = { limit };
  for (const p of filterParts) {
    Object.assign(variables, p.varValue);
  }
  // 组装 filter 字符串
  const filterFragments = filterParts.map((p) => p.fragment);

  // 如果有 query（全文搜索），使用 Linear 的 issues 搜索接口
  // 注意：全文搜索和其他 filter 可以组合使用
  if (args.query) {
    filterFragments.push(`title: { containsIgnoreCase: $queryStr }`);
    varDefs.push("$queryStr: String!");
    variables.queryStr = args.query;
  }

  const filterStr = filterFragments.length > 0
    ? `filter: { ${filterFragments.join(", ")} }`
    : "";

  const query = `
    query ListIssues(${varDefs.join(", ")}) {
      issues(
        ${filterStr}
        first: $limit
        includeArchived: false
        orderBy: updatedAt
      ) {
        nodes {
          id identifier title priority priorityLabel
          state { name type }
          assignee { displayName }
          parent { id }
        }
      }
    }
  `;

  const data = await graphql<{ issues?: { nodes: RawListItem[] } }>(query, variables);
  const nodes = data.issues?.nodes ?? [];

  // ── 响应转换 ─────────────────────────────────────────────────────
  //
  // 主要做两件事：
  // 1. priority 合并：{ priority: 3, priorityLabel: "Normal" } → { value: 3, name: "Normal" }
  // 2. parent 展平：{ parent: { id: "xxx" } } → { parentId: "xxx" }

  return nodes.map((n): CompactListItem => ({
    id: n.id,
    identifier: n.identifier,
    title: n.title,
    priority: { value: n.priority, name: n.priorityLabel },
    state: { name: n.state.name, type: n.state.type },
    assignee: n.assignee?.displayName,
    parentId: n.parent?.id ?? null,
  }));
}
