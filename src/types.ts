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
