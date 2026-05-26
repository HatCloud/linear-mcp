// src/tools/list-documents.ts
//
// 列出 Linear 项目下的文档。
// 通过 project.documents 嵌套查询获取文档列表——Linear 没有根级 documents 查询，
// 文档是 project 的附属实体。

import type { GraphQLFn } from "../graphql.js";

export interface ListDocumentsArgs {
  projectId: string;  // 项目 UUID
  limit?: number;     // 最多返回条数，默认 25
}

export async function listDocuments(
  args: ListDocumentsArgs,
  graphql: GraphQLFn
): Promise<Array<{ id: string; title: string; url: string; updatedAt: string }>> {
  const limit = args.limit ?? 25;

  const data = await graphql<{
    project?: {
      documents?: {
        nodes: Array<{ id: string; title: string; url: string; updatedAt: string }>;
      };
    } | null;
  }>(
    `query ListDocuments($projectId: String!, $limit: Int!) {
      project(id: $projectId) {
        documents(first: $limit) {
          nodes {
            id
            title
            url
            updatedAt
          }
        }
      }
    }`,
    { projectId: args.projectId, limit }
  );

  if (!data.project) {
    throw new Error(`Project not found: ${args.projectId}`);
  }

  return data.project.documents?.nodes ?? [];
}
