// src/types.ts
// 工具函数的输入/输出类型定义
// 这些类型是"精简版"——只包含 skills 实际用到的字段，
// 不包含 Linear API 返回的全量数据（如用户头像、设备信息等无用字段）

// 单个 issue 的完整详情（用于 get_issue 工具）
export interface CompactIssue {
  id: string;
  identifier: string; // 如 "HAT-155"
  title: string;
  description?: string;
  state: { name: string; type: string }; // type: "started" | "completed" | "canceled" 等
  priority: { value: number; name: string }; // value: 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
  url: string;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; displayName: string } | null;
  team: { id: string; name: string; key: string }; // key 如 "HAT"
  project: { id: string; name: string } | null;
  labels: string[]; // 直接是名称数组，不是对象数组
  // 以下字段为可选，由 get_issue 的参数控制是否返回
  comments?: Array<{
    id: string;
    body: string;
    author: string; // displayName
    createdAt: string;
  }>;
  subIssues?: Array<{
    id: string;
    identifier: string;
    title: string;
    state: { name: string; type: string };
    priority: { value: number; name: string };
  }>;
}

// issue 列表中每条的精简格式（用于 list_issues 工具）
// 比 CompactIssue 更精简：没有 description、comments 等大字段
export interface CompactListItem {
  id: string;
  identifier: string;
  title: string;
  priority: { value: number; name: string };
  state: { name: string; type: string };
  assignee?: string; // 只保留 displayName，不需要 id
  parentId?: string | null;
}

// 状态映射（用于 get_status_map 工具的返回值）
export type StatusMap = Record<string, string>; // { "In Progress": "uuid-xxx", ... }

// 完整状态映射结果（get_status_map 工具的返回类型）
// 拆分为 map（name→UUID，用于常规操作）和 all（完整列表，含 type 信息）
// 避免使用 "_all" 字符串 hack 将不同类型的数据混入同一个 Record
export interface StatusMapResult {
  // 常用状态的 name → UUID 映射，供 issueUpdate 等操作直接使用
  map: Record<string, string>;
  // 团队所有状态的完整列表，含 type 信息，供需要精确匹配的场景使用
  all: Array<{ id: string; name: string; type: string }>;
}

// 评论类型（用于 list_comments 和 get_comment 工具）
export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  displayName: string;  // user.displayName
}

// 附件类型（用于 list_attachments 工具）
export interface Attachment {
  id: string;
  url: string;
  title: string;
  createdAt: string;
}
