// src/tools/list-attachments.ts
//
// 列出指定 issue 的所有附件。
//
// 注意：AttachmentFilter 不支持直接按 issue 过滤，
// 所以我们通过 issue 关系遍历来获取附件。

import type { GraphQLFn } from "../graphql.js";
import type { Attachment } from "../types.js";

export interface ListAttachmentsArgs {
  issueId: string;  // Issue UUID
  limit?: number;    // 默认 25，最大 50
}

export async function listAttachments(
  args: ListAttachmentsArgs,
  graphql: GraphQLFn
): Promise<Attachment[]> {
  const limit = Math.min(args.limit ?? 25, 50);

  const data = await graphql<{
    issue?: {
      attachments?: {
        nodes: Array<{
          id: string;
          url: string;
          title: string;
          createdAt: string;
        }>;
      };
    };
  }>(
    `query ListAttachments($issueId: String!, $limit: Int!) {
      issue(id: $issueId) {
        attachments(first: $limit, orderBy: createdAt) {
          nodes {
            id
            url
            title
            createdAt
          }
        }
      }
    }`,
    { issueId: args.issueId, limit }
  );

  return (data.issue?.attachments?.nodes ?? []).map((a) => ({
    id: a.id,
    url: a.url,
    title: a.title,
    createdAt: a.createdAt,
  }));
}
