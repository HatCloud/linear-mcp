// src/tools/create-project.ts
//
// 创建新项目。

import type { GraphQLFn } from "../graphql.js";

export interface CreateProjectArgs {
  teamId: string;  // 团队 UUID
  name: string;     // 项目名称
  icon?: string;    // 可选图标（emoji 或图标 ID）
}

export async function createProject(
  args: CreateProjectArgs,
  graphql: GraphQLFn
): Promise<{ id: string; name: string; url: string }> {
  const data = await graphql<{
    projectCreate?: {
      success: boolean;
      project?: { id: string; name: string; url: string };
    };
  }>(
    `mutation CreateProject($input: ProjectCreateInput!) {
      projectCreate(input: $input) {
        success
        project {
          id
          name
          url
        }
      }
    }`,
    { input: { teamIds: [args.teamId], name: args.name, icon: args.icon } }
  );

  const result = data.projectCreate;
  if (!result?.success) {
    throw new Error(`projectCreate failed for team: ${args.teamId}`);
  }
  if (!result.project) {
    throw new Error(`projectCreate succeeded but returned no project data`);
  }
  return {
    id: result.project.id,
    name: result.project.name,
    url: result.project.url,
  };
}
