// src/tools/update-project.ts
//
// 更新项目信息。

import type { GraphQLFn } from "../graphql.js";

export interface UpdateProjectArgs {
  id: string;       // 项目 UUID
  name?: string;    // 新名称
}

export async function updateProject(
  args: UpdateProjectArgs,
  graphql: GraphQLFn
): Promise<{ id: string; name: string; state: string; url: string }> {
  const input: Record<string, unknown> = {};
  if (args.name !== undefined) input.name = args.name;

  const data = await graphql<{
    projectUpdate?: {
      success: boolean;
      project?: { id: string; name: string; state: string; url: string };
    };
  }>(
    `mutation UpdateProject($id: String!, $input: ProjectUpdateInput!) {
      projectUpdate(id: $id, input: $input) {
        success
        project {
          id
          name
          state
          url
        }
      }
    }`,
    { id: args.id, input }
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
