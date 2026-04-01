// src/tools/create-attachment.ts
//
// 为指定 issue 创建附件（URL）。

import type { GraphQLFn } from "../graphql.js";

export interface CreateAttachmentArgs {
  issueId: string;  // Issue UUID
  url: string;      // 附件 URL
  title?: string;   // 可选标题
}

export async function createAttachment(
  args: CreateAttachmentArgs,
  graphql: GraphQLFn
): Promise<{ id: string; url: string }> {
  const data = await graphql<{
    attachmentCreate?: {
      success: boolean;
      attachment?: { id: string; url: string };
    };
  }>(
    `mutation CreateAttachment($input: AttachmentCreateInput!) {
      attachmentCreate(input: $input) {
        success
        attachment { id url }
      }
    }`,
    { input: { issueId: args.issueId, url: args.url, title: args.title } }
  );

  const result = data.attachmentCreate;
  if (!result?.success) {
    throw new Error(`attachmentCreate failed for issue: ${args.issueId}`);
  }
  if (!result.attachment) {
    throw new Error(`attachmentCreate succeeded but returned no attachment data`);
  }
  return {
    id: result.attachment.id,
    url: result.attachment.url,
  };
}
