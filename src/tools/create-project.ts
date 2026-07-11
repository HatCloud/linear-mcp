// src/tools/create-project.ts
//
// 创建一个信息完备的 project：支持 Linear project 的完整字段集，并可在创建时
// 一并批量创建里程碑（milestone 在 Linear 是独立实体，需单独 mutation）。
//
// 字段只在调用方实际传入时才进入 input（沿用「undefined vs absent」纪律，
// 避免把 undefined 塞进 input 导致意外覆盖）。里程碑逐个顺序创建，某个失败不
// 整体抛错（project 已建成）——返回结构化结果，逐个标 created/failed。

import type { GraphQLFn } from "../graphql.js";

export interface MilestoneInput {
  name: string;
  description?: string;
  targetDate?: string; // YYYY-MM-DD (TimelessDate)
}

export interface CreateProjectArgs {
  teamId: string; // 团队 UUID
  name: string; // 项目名称
  icon?: string; // Linear 图标名（如 "FaceMonocle"）或 emoji
  color?: string; // hex 颜色，如 "#f2994a"
  description?: string; // 一句话摘要
  content?: string; // overview 正文（Markdown）
  statusId?: string; // 项目状态 UUID
  leadId?: string; // 负责人用户 UUID
  memberIds?: string[]; // 成员用户 UUID 列表
  startDate?: string; // YYYY-MM-DD
  targetDate?: string; // YYYY-MM-DD
  priority?: number; // 0=None,1=Urgent,2=High,3=Normal,4=Low
  milestones?: MilestoneInput[];
}

export interface MilestoneResult {
  name: string;
  id?: string;
  status: "created" | "failed";
  error?: string;
}

export interface CreateProjectResult {
  id: string;
  name: string;
  url: string;
  milestones?: MilestoneResult[];
}

export async function createProject(
  args: CreateProjectArgs,
  graphql: GraphQLFn,
): Promise<CreateProjectResult> {
  // 只把实际传入的字段放进 input（teamIds 必填）。
  const input: Record<string, unknown> = { teamIds: [args.teamId], name: args.name };
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
    projectCreate?: {
      success: boolean;
      project?: { id: string; name: string; url: string };
    };
  }>(
    `
      mutation CreateProject($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          success
          project {
            id
            name
            url
          }
        }
      }
    `,
    { input },
  );

  const result = data.projectCreate;
  if (!result?.success) {
    throw new Error(`projectCreate failed for team: ${args.teamId}`);
  }
  if (!result.project) {
    throw new Error(`projectCreate succeeded but returned no project data`);
  }

  const project = result.project;
  const out: CreateProjectResult = {
    id: project.id,
    name: project.name,
    url: project.url,
  };

  // 里程碑：按数组顺序逐个创建（sortOrder = index）。project 已建成，某个失败
  // 不整体抛错——逐个记 created/failed，让调用方可对失败项补建。
  if (args.milestones?.length) {
    const milestones: MilestoneResult[] = [];
    for (const [i, m] of args.milestones.entries()) {
      const msInput: Record<string, unknown> = {
        projectId: project.id,
        name: m.name,
        sortOrder: i,
      };
      if (m.description !== undefined) msInput.description = m.description;
      if (m.targetDate !== undefined) msInput.targetDate = m.targetDate;

      try {
        const msData = await graphql<{
          projectMilestoneCreate?: {
            success: boolean;
            projectMilestone?: { id: string; name: string };
          };
        }>(
          `
            mutation CreateMilestone($input: ProjectMilestoneCreateInput!) {
              projectMilestoneCreate(input: $input) {
                success
                projectMilestone {
                  id
                  name
                }
              }
            }
          `,
          { input: msInput },
        );
        const ms = msData.projectMilestoneCreate;
        if (!ms?.success || !ms.projectMilestone) {
          throw new Error(`projectMilestoneCreate failed for milestone: ${m.name}`);
        }
        milestones.push({ name: m.name, id: ms.projectMilestone.id, status: "created" });
      } catch (err) {
        milestones.push({
          name: m.name,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    out.milestones = milestones;
  }

  return out;
}
