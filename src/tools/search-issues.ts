// src/tools/search-issues.ts
//
// ── 为什么这个工具存在？ ──────────────────────────────────────────────
//
// 现有的 list-issues 主要用于"列出项目/团队下的 issues"，
// 但 skills 有时需要更通用的"按标题搜索"能力。
//
// 本工具专注于全文搜索场景，支持多维度过滤：
//   - team: 按团队 UUID 过滤
//   - project: 按项目名称过滤
//   - assignee: "me" 或 UUID
//   - state: 状态名过滤
//
// 注意：title 搜索使用 containsIgnoreCase（不区分大小写的前缀匹配）。

import type { GraphQLFn } from "../graphql.js";

export interface SearchIssuesArgs {
  query: string;          // 标题搜索关键词
  team?: string;         // 团队 UUID
  project?: string;      // 项目名称
  assignee?: string;     // "me" | UUID
  state?: string;        // 状态名
  limit?: number;        // 默认 25，最大 50
}

interface RawSearchItem {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  priorityLabel: string;
  state: { name: string; type: string };
  assignee: { displayName: string } | null;
  parent: { id: string } | null;
}

interface FilterPart {
  fragment: string;
  varDef: string;
  varValue: Record<string, unknown>;
}

export async function searchIssues(
  args: SearchIssuesArgs,
  graphql: GraphQLFn
): Promise<Array<{
  id: string;
  identifier: string;
  title: string;
  priority: { value: number; name: string };
  priorityLabel: string;
  state: { name: string; type: string };
  assignee?: string;
  parentId?: string | null;
}>> {
  const limit = Math.min(args.limit ?? 25, 50);
  const filterParts: FilterPart[] = [];

  // 标题搜索（固定条件）
  filterParts.push({
    fragment: "title: { containsIgnoreCase: $query }",
    varDef: "$query: String!",
    varValue: { query: args.query },
  });

  // team 过滤
  if (args.team) {
    filterParts.push({
      fragment: "team: { id: { eq: $teamId } }",
      varDef: "$teamId: ID!",
      varValue: { teamId: args.team },
    });
  }

  // project 过滤
  if (args.project) {
    filterParts.push({
      fragment: "project: { name: { eq: $projectName } }",
      varDef: "$projectName: String!",
      varValue: { projectName: args.project },
    });
  }

  // assignee 过滤
  if (args.assignee === "me") {
    const viewerData = await graphql<{ viewer?: { id: string } }>("query { viewer { id } }");
    const meId = viewerData.viewer?.id;
    if (!meId) {
      throw new Error('Failed to resolve current user for assignee="me".');
    }
    filterParts.push({
      fragment: "assignee: { id: { eq: $assigneeId } }",
      varDef: "$assigneeId: ID!",
      varValue: { assigneeId: meId },
    });
  } else if (args.assignee) {
    filterParts.push({
      fragment: "assignee: { id: { eq: $assigneeId } }",
      varDef: "$assigneeId: ID!",
      varValue: { assigneeId: args.assignee },
    });
  }

  // state 过滤
  if (args.state) {
    filterParts.push({
      fragment: "state: { name: { eq: $stateName } }",
      varDef: "$stateName: String!",
      varValue: { stateName: args.state },
    });
  }

  const varDefs = ["$query: String!", "$limit: Int!", ...filterParts.map((p) => p.varDef).filter((v, i) => i > 0)];
  const variables: Record<string, unknown> = { query: args.query, limit };
  for (const p of filterParts) {
    Object.assign(variables, p.varValue);
  }

  const filterStr = filterParts.length > 0
    ? `filter: { ${filterParts.map((p) => p.fragment).join(", ")} }`
    : "";

  const query = `
    query SearchIssues(${varDefs.join(", ")}) {
      issues(
        ${filterStr}
        first: $limit
        includeArchived: false
        orderBy: updatedAt
      ) {
        nodes {
          id identifier title priority priorityLabel
          state { name type }
          assignee { displayName }
          parent { id }
        }
      }
    }
  `;

  const data = await graphql<{ issues?: { nodes: RawSearchItem[] } }>(query, variables);
  const nodes = data.issues?.nodes ?? [];

  return nodes.map((n) => ({
    id: n.id,
    identifier: n.identifier,
    title: n.title,
    priority: { value: n.priority, name: n.priorityLabel },
    priorityLabel: n.priorityLabel,
    state: { name: n.state.name, type: n.state.type },
    assignee: n.assignee?.displayName,
    parentId: n.parent?.id ?? null,
  }));
}
