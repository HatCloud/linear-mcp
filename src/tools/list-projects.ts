// src/tools/list-projects.ts
//
// 列出项目，支持按团队过滤。

import type { GraphQLFn } from "../graphql.js";

export interface ListProjectsArgs {
  team?: string;  // 团队名称（精确匹配）
  limit?: number;  // 默认 25，最大 50
}

interface RawProject {
  id: string;
  name: string;
  state: string;
  teams: Array<{ id: string; key: string }>;
}

export async function listProjects(
  args: ListProjectsArgs,
  graphql: GraphQLFn
): Promise<Array<{
  id: string;
  name: string;
  state: string;
  teams: Array<{ id: string; key: string }>;
}>> {
  const limit = Math.min(args.limit ?? 25, 50);

  let query: string;
  let variables: Record<string, unknown>;

  if (args.team) {
    query = `
      query ListProjectsByTeam($teamName: String!, $limit: Int!) {
        projects(
          filter: { team: { name: { eq: $teamName } } }
          first: $limit
        ) {
          nodes {
            id
            name
            state
            teams {
              id
              key
            }
          }
        }
      }
    `;
    variables = { teamName: args.team, limit };
  } else {
    query = `
      query ListProjects($limit: Int!) {
        projects(first: $limit) {
          nodes {
            id
            name
            state
            teams {
              id
              key
            }
          }
        }
      }
    `;
    variables = { limit };
  }

  const data = await graphql<{
    projects?: { nodes: RawProject[] };
  }>(query, variables);

  return (data.projects?.nodes ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    state: p.state,
    teams: p.teams,
  }));
}
