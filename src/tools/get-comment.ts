// src/tools/get-comment.ts
//
// 获取单条评论详情。

import type { GraphQLFn } from "../graphql.js";
import type { Comment } from "../types.js";

export interface GetCommentArgs {
  id: string;  // Comment UUID
}

export async function getComment(
  args: GetCommentArgs,
  graphql: GraphQLFn
): Promise<Comment> {
  const data = await graphql<{
    comment?: {
      id: string;
      body: string;
      createdAt: string;
      user: { displayName: string };
    };
  }>(
    `query GetComment($id: String!) {
      comment(id: $id) {
        id
        body
        createdAt
        user { displayName }
      }
    }`,
    { id: args.id }
  );

  const c = data.comment;
  if (!c) {
    throw new Error(`Comment not found: ${args.id}`);
  }
  return {
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    displayName: c.user.displayName,
  };
}
