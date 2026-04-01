// src/tools/list-teams.ts
//
// 列出所有团队。

import type { GraphQLFn } from "../graphql.js";

export interface ListTeamsArgs {}

export async function listTeams(
  _args: ListTeamsArgs,
  graphql: GraphQLFn
): Promise<Array<{ id: string; key: string }>> {
  const data = await graphql<{
    teams?: {
      nodes: Array<{ id: string; key: string }>;
    };
  }>(
    `query ListTeams {
      teams {
        nodes {
          id
          key
        }
      }
    }`
  );

  return data.teams?.nodes ?? [];
}
