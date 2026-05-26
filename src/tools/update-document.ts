// src/tools/update-document.ts
//
// 更新 Linear 文档的标题或内容。

import type { GraphQLFn } from "../graphql.js";

export interface UpdateDocumentArgs {
  id: string;       // 文档 UUID
  title?: string;   // 新标题
  content?: string; // 新内容（Markdown），支持 \\n 字面量转换为换行
}

export async function updateDocument(
  args: UpdateDocumentArgs,
  graphql: GraphQLFn
): Promise<{ id: string; title: string; url: string }> {
  const input: Record<string, unknown> = {};
  if (args.title !== undefined) input.title = args.title;
  if (args.content !== undefined) input.content = args.content.replace(/\\n/g, "\n");

  const data = await graphql<{
    documentUpdate?: {
      success: boolean;
      document?: { id: string; title: string; url: string } | null;
    };
  }>(
    `mutation UpdateDocument($id: String!, $input: DocumentUpdateInput!) {
      documentUpdate(id: $id, input: $input) {
        success
        document {
          id
          title
          url
        }
      }
    }`,
    { id: args.id, input }
  );

  const result = data.documentUpdate;
  if (!result?.success) {
    throw new Error(`documentUpdate failed for document: ${args.id}`);
  }
  if (!result.document) {
    throw new Error(`documentUpdate succeeded but returned no document data`);
  }
  return {
    id: result.document.id,
    title: result.document.title,
    url: result.document.url,
  };
}
