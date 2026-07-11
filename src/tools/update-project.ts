// src/tools/update-project.ts
//
// 更新项目信息。

import type { GraphQLFn } from "../graphql.js";

export interface UpdateProjectArgs {
  id: string; // 项目 UUID
  name?: string; // 新名称
  icon?: string; // Linear 图标名（如 "FaceMonocle"）或 emoji
  color?: string; // hex 颜色
  description?: string; // 一句话摘要
  content?: string; // overview 正文（Markdown）
  statusId?: string; // 项目状态 UUID
  leadId?: string; // 负责人用户 UUID
  memberIds?: string[]; // 成员用户 UUID 列表
  startDate?: string; // YYYY-MM-DD
  targetDate?: string; // YYYY-MM-DD
  priority?: number; // 0=None,1=Urgent,2=High,3=Normal,4=Low
}

export async function updateProject(
  args: UpdateProjectArgs,
  graphql: GraphQLFn,
): Promise<{ id: string; name: string; state: string; url: string }> {
  // 只把实际传入的字段放进 input，避免把未传字段误清空（undefined vs absent）。
  const input: Record<string, unknown> = {};
  if (args.name !== undefined) input.name = args.name;
  if (args.icon !== undefined) input.icon = args.icon;
  if (args.color !== undefined) input.color = args.color;
  if (args.description !== undefined) input.description = args.description;
  if (args.content !== undefined) input.content = args.content;
  if (args.statusId !== undefined) input.statusId = args.statusId;
  if (args.leadId !== undefined) input.leadId = args.leadId;
  if (args.memberIds !== undefined) input.memberIds = args.memberIds;
  if (args.startDate !== undefined) input.startDate = args.startDate;
  if (args.targetDate !== undefined) input.targetDate = args.targetDate;
  if (args.priority !== undefined) input.priority = args.priority;

  const data = await graphql<{
    projectUpdate?: {
      success: boolean;
      project?: { id: string; name: string; state: string; url: string };
    };
  }>(
    `
      mutation UpdateProject($id: String!, $input: ProjectUpdateInput!) {
        projectUpdate(id: $id, input: $input) {
          success
          project {
            id
            name
            state
            url
          }
        }
      }
    `,
    { id: args.id, input },
  );

  const result = data.projectUpdate;
  if (!result?.success) {
    throw new Error(`projectUpdate failed for project: ${args.id}`);
  }
  if (!result.project) {
    throw new Error(`projectUpdate succeeded but returned no project data`);
  }
  return {
    id: result.project.id,
    name: result.project.name,
    state: result.project.state,
    url: result.project.url,
  };
}
