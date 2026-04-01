// src/tools/archive-issue.ts
//
// 归档指定 issue。

import type { GraphQLFn } from "../graphql.js";

export interface ArchiveIssueArgs {
  id: string;  // Issue UUID
}

export async function archiveIssue(
  args: ArchiveIssueArgs,
  graphql: GraphQLFn
): Promise<{ success: boolean }> {
  const data = await graphql<{
    issueArchive?: { success: boolean };
  }>(
    `mutation ArchiveIssue($id: String!) {
      issueArchive(id: $id) {
        success
      }
    }`,
    { id: args.id }
  );

  const result = data.issueArchive;
  if (!result?.success) {
    throw new Error(`issueArchive failed for issue: ${args.id}`);
  }
  return { success: true };
}
