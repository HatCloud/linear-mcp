// src/tools/get-issue.ts
//
// ── 为什么这个工具存在？ ──────────────────────────────────────────────
//
// 旧系统（hat-linear-ops Python 脚本）在获取一个 issue 的完整信息时，
// 需要分 4 次独立调用：
//   1. get-issue → 基本字段
//   2. get-issue --comments → 评论列表
//   3. list-issues --parentId=xxx → 子 issue
//   4. get-user → assignee 详情
//
// 这造成了大量的 API 往返和上下文浪费。
//
// 本工具通过单次 GraphQL 查询，一次性拿到 issue 的全部信息（含 comments 和 sub-issues）。
// GraphQL 的精髓就在于此：客户端声明需要什么，服务端一次性返回——不多不少。
//
// ── GraphQL 查询结构说明 ──────────────────────────────────────────────
//
// Linear 的 `issue(id: $id)` 接口同时支持两种 id 格式：
//   - UUID：如 "1de25fc9-xxx-yyy-zzz"（Linear 内部主键）
//   - identifier：如 "HAT-155"（人类可读的项目缩写+序号）
// 因此不需要像旧 Python 脚本那样先做 identifier→UUID 的转换。
//
// 字段选择的理由：
//   - id, identifier, title, description：基础身份信息
//   - state { id name type }：type 用于程序判断（started/completed/canceled），name 用于显示
//   - priority + priorityLabel：priority 是数字（0-4），priorityLabel 是对应的文本
//     两者都保留，方便不同场景使用（程序判断用数字，显示用文本）
//   - url：直接链接到 Linear 界面，方便在消息/报告中引用
//   - createdAt, updatedAt：时间戳，用于排序和 "多久没更新" 判断
//   - assignee { id displayName }：只需要两个字段，不需要邮件/头像等
//   - team { id name key }：key 如 "HAT"，是最常用的简短标识
//   - project { id name }：所属项目（可为 null）
//   - labels { nodes { name } }：标签列表，nodes 数组会在响应转换时展平为 string[]
//   - comments（可选）：{ nodes { id body createdAt user { displayName } } }
//     仅当 args.comments=true 时查询，避免默认查询带回大量文本
//   - children（可选）：子 issue 列表，仅当 args.sub_issues=true 时查询
//
// ── 响应转换逻辑 ──────────────────────────────────────────────────────
//
// GraphQL 的列表字段统一用 { nodes: [...] } 包装（这是 Linear API 的分页约定）。
// 但对于工具调用者来说，多一层 nodes 包装只是噪音，所以这里做展平：
//
//   labels.nodes[{ name }]           → string[]（只取 name，去掉对象包装）
//   comments.nodes[{ body, user }]   → CompactIssue["comments"]（同时做字段重命名）
//   children.nodes[{ ... }]          → CompactIssue["subIssues"]
//
// priority 的转换：GraphQL 返回 { priority: 3, priorityLabel: "Normal" }，
// 而 CompactIssue 定义的是 { priority: { value: 3, name: "Normal" } }，
// 这样语义更清晰，也避免调用者搞混 priority 数字和 priorityLabel 字符串。

import type { GraphQLFn } from "../graphql.js";
import type { CompactIssue } from "../types.js";

// ── GraphQL 查询模板 ───────────────────────────────────────────────────

// 基础字段（始终查询）
const BASE_FIELDS = `
  id identifier title description
  state { id name type }
  priority priorityLabel
  url createdAt updatedAt
  assignee { id displayName }
  team { id name key }
  project { id name }
  labels { nodes { name } }
`;

// 评论字段（仅 args.comments=true 时拼入）
const COMMENTS_FIELD = `
  comments {
    nodes {
      id
      body
      createdAt
      user { displayName }
    }
  }
`;

// 子 issue 字段（仅 args.sub_issues=true 时拼入）
const CHILDREN_FIELD = `
  children {
    nodes {
      id identifier title
      state { name type }
      priority priorityLabel
    }
  }
`;

// ── 主函数 ────────────────────────────────────────────────────────────

export async function getIssue(
  args: { id: string; comments?: boolean; sub_issues?: boolean },
  graphql: GraphQLFn
): Promise<CompactIssue> {
  // 动态拼接查询：根据参数决定是否包含 comments 和 children 字段
  // 这样不传 comments=true 时，查询体更小，响应更快
  const query = `
    query GetIssue($id: String!) {
      issue(id: $id) {
        ${BASE_FIELDS}
        ${args.comments ? COMMENTS_FIELD : ""}
        ${args.sub_issues ? CHILDREN_FIELD : ""}
      }
    }
  `;

  const response = await graphql<RawGetIssueResponse>(query, { id: args.id });

  const raw = response.issue;
  if (!raw) {
    throw new Error(`Issue not found: ${args.id}`);
  }

  return transformIssue(raw, args);
}

// ── 原始 GraphQL 响应类型（内部用，不导出）────────────────────────────

interface RawGetIssueResponse {
  issue: RawIssue | null;
}

interface RawIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: { id: string; name: string; type: string };
  priority: number;
  priorityLabel: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; displayName: string } | null;
  team: { id: string; name: string; key: string };
  project: { id: string; name: string } | null;
  labels: { nodes: Array<{ name: string }> };
  comments?: {
    nodes: Array<{
      id: string;
      body: string;
      createdAt: string;
      user: { displayName: string } | null;
    }>;
  };
  children?: {
    nodes: Array<{
      id: string;
      identifier: string;
      title: string;
      state: { name: string; type: string };
      priority: number;
      priorityLabel: string;
    }>;
  };
}

// ── 响应转换函数 ───────────────────────────────────────────────────────

function transformIssue(
  raw: RawIssue,
  args: { comments?: boolean; sub_issues?: boolean }
): CompactIssue {
  const result: CompactIssue = {
    id: raw.id,
    identifier: raw.identifier,
    title: raw.title,
    description: raw.description,
    state: { name: raw.state.name, type: raw.state.type },

    // priority 转换：GraphQL 的两个独立字段合并为一个有语义的对象
    // { priority: 3, priorityLabel: "Normal" } → { value: 3, name: "Normal" }
    priority: { value: raw.priority, name: raw.priorityLabel },

    url: raw.url,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    assignee: raw.assignee,
    team: raw.team,
    project: raw.project,

    // labels 展平：去掉 nodes 包装，并只保留 name 字符串
    // [{ name: "bug" }, { name: "urgent" }] → ["bug", "urgent"]
    labels: raw.labels.nodes.map((l) => l.name),
  };

  // 条件字段：只在请求了对应参数时才设置
  if (args.comments && raw.comments) {
    // comments 展平并重命名字段：user.displayName → author
    result.comments = raw.comments.nodes.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: c.user?.displayName ?? "(unknown)",
    }));
  }

  if (args.sub_issues && raw.children) {
    // subIssues 展平并转换 priority 格式（与主 issue 保持一致）
    result.subIssues = raw.children.nodes.map((child) => ({
      id: child.id,
      identifier: child.identifier,
      title: child.title,
      state: { name: child.state.name, type: child.state.type },
      priority: { value: child.priority, name: child.priorityLabel },
    }));
  }

  return result;
}
