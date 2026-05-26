// src/tools/delete-document.ts
//
// 删除指定 Linear 文档（硬删除，不可恢复）。

import type { GraphQLFn } from "../graphql.js";

export interface DeleteDocumentArgs {
  id: string;  // 文档 UUID
}

export async function deleteDocument(
  args: DeleteDocumentArgs,
  graphql: GraphQLFn
): Promise<{ success: boolean }> {
  const data = await graphql<{
    documentDelete?: { success: boolean };
  }>(
    `mutation DeleteDocument($id: String!) {
      documentDelete(id: $id) {
        success
      }
    }`,
    { id: args.id }
  );

  const result = data.documentDelete;
  if (!result?.success) {
    throw new Error(`documentDelete failed for document: ${args.id}`);
  }
  return { success: true };
}
