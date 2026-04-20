// src/tools/list-comments.ts
//
// 列出指定 issue 的所有评论。

import type { GraphQLFn } from "../graphql.js";
import type { Comment } from "../types.js";

export interface ListCommentsArgs {
  issueId: string;  // Issue UUID 或 identifier（如 "HAT-155"）
  limit?: number;   // 默认 25，最大 50
}

export async function listComments(
  args: ListCommentsArgs,
  graphql: GraphQLFn
): Promise<Comment[]> {
  const limit = Math.min(args.limit ?? 25, 50);

  const data = await graphql<{
    comments?: {
      nodes: Array<{
        id: string;
        body: string;
        createdAt: string;
        user: { displayName: string };
      }>;
    };
  }>(
    `query ListComments($issueId: ID!, $limit: Int!) {
      comments(
        filter: { issue: { id: { eq: $issueId } } }
        first: $limit
        orderBy: createdAt
      ) {
        nodes {
          id
          body
          createdAt
          user { displayName }
        }
      }
    }`,
    { issueId: args.issueId, limit }
  );

  return (data.comments?.nodes ?? []).map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    displayName: c.user.displayName,
  }));
}
