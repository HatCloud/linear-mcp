// src/server.ts
//
// Linear MCP Server — 入口文件
//
// 将 20 个工具函数组装为一个 MCP server，通过 stdio transport 与客户端通信。
// 启动时读取 LINEAR_API_KEY 环境变量，创建 GraphQL 客户端，注册工具。

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { createGraphQLClient } from "./graphql.js";
import { getIssue } from "./tools/get-issue.js";
import { listIssues } from "./tools/list-issues.js";
import { searchIssues } from "./tools/search-issues.js";
import { getStatusMap } from "./tools/get-status-map.js";
import { updateIssue } from "./tools/update-issue.js";
import { createIssue } from "./tools/create-issue.js";
import { createComment } from "./tools/create-comment.js";
import { createDocument } from "./tools/create-document.js";
import { listComments } from "./tools/list-comments.js";
import { getComment } from "./tools/get-comment.js";
import { listAttachments } from "./tools/list-attachments.js";
import { createAttachment } from "./tools/create-attachment.js";
import { archiveIssue } from "./tools/archive-issue.js";
import { listTeams } from "./tools/list-teams.js";
import { listProjects } from "./tools/list-projects.js";
import { createProject, type CreateProjectArgs } from "./tools/create-project.js";
import { updateProject, type UpdateProjectArgs } from "./tools/update-project.js";
import { listDocuments } from "./tools/list-documents.js";
import { deleteDocument } from "./tools/delete-document.js";
import { updateDocument } from "./tools/update-document.js";

// ── 环境变量检查 ───────────────────────────────────────────────────────

const apiKey = process.env.LINEAR_API_KEY;
if (!apiKey) {
  console.error("Error: LINEAR_API_KEY environment variable is not set.");
  console.error("Get your API key from Linear Settings → API → Personal API Keys.");
  process.exit(1);
}

// ── GraphQL 客户端 ────────────────────────────────────────────────────

const graphql = createGraphQLClient(apiKey);

// ── MCP Server ────────────────────────────────────────────────────────

const server = new Server(
  { name: "@hatcloud/linear-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// ── ListTools Handler ─────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_issue",
      description:
        "Gets full details of a Linear issue (description, comments, sub-issues in one query)",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: 'Issue UUID or identifier like "HAT-155"',
          },
          comments: {
            type: "boolean",
            description: "Include comments (default false)",
          },
          sub_issues: {
            type: "boolean",
            description: "Include sub-issues (default false)",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "list_issues",
      description: "Lists issues with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          project: {
            type: "string",
            description: "Project name or ID",
          },
          assignee: {
            type: "string",
            description: '"me", UUID, or "null" for unassigned',
          },
          state: {
            type: "string",
            description: 'State name filter (e.g. "started", "In Progress")',
          },
          parentId: {
            type: "string",
            description: "Filter to sub-issues of this parent UUID",
          },
          priority: {
            type: "number",
            description: "优先级过滤：0=无, 1=紧急, 2=高, 3=普通, 4=低",
          },
          query: {
            type: "string",
            description: "按标题全文搜索",
          },
          limit: {
            type: "number",
            description: "Max results (default 25)",
          },
        },
      },
    },
    {
      name: "get_status_map",
      description:
        "Gets a map of status names to IDs for a team (locally cached; refetches only on cache miss / expect miss / refresh)",
      inputSchema: {
        type: "object",
        properties: {
          team: {
            type: "string",
            description: 'Team key (e.g. "HAT") or UUID',
          },
          refresh: {
            type: "boolean",
            description: "Bypass the local cache and refetch from Linear",
          },
          expect: {
            type: "string",
            description:
              "A status name you expect to exist; if a cached map lacks it, the cache is treated as stale and refetched once",
          },
        },
        required: ["team"],
      },
    },
    {
      name: "update_issue",
      description: "Updates fields of an existing issue",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Issue UUID",
          },
          title: {
            type: "string",
            description: "New issue title",
          },
          description: {
            type: "string",
            description: "New description (Markdown)",
          },
          state: {
            type: "string",
            description: "State UUID (get from get_status_map)",
          },
          assignee: {
            type: "string",
            description: "User UUID",
          },
          priority: {
            type: "number",
            description: "Priority: 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low",
          },
          parentId: {
            type: ["string", "null"],
            description: "Parent issue UUID; null removes parent",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "create_issue",
      description: "Creates a new issue",
      inputSchema: {
        type: "object",
        properties: {
          teamId: {
            type: "string",
            description: "Team UUID",
          },
          title: {
            type: "string",
            description: "Issue title",
          },
          description: {
            type: "string",
            description: "Issue description (Markdown)",
          },
          projectId: {
            type: "string",
            description: "Project UUID to assign the issue to",
          },
          state: {
            type: "string",
            description: "Initial state UUID",
          },
          assignee: {
            type: "string",
            description: "Assignee user UUID",
          },
          priority: {
            type: "number",
            description: "Priority: 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low",
          },
        },
        required: ["teamId", "title"],
      },
    },
    {
      name: "create_comment",
      description: "Adds a comment to an issue",
      inputSchema: {
        type: "object",
        properties: {
          issueId: {
            type: "string",
            description: "Issue UUID",
          },
          body: {
            type: "string",
            description: "Comment body (Markdown)",
          },
        },
        required: ["issueId", "body"],
      },
    },
    {
      name: "create_document",
      description:
        "Creates a document in Linear belonging to a project, optionally linked to an issue",
      inputSchema: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Document title",
          },
          content: {
            type: "string",
            description: "Document content (Markdown)",
          },
          projectId: {
            type: "string",
            description: "项目 UUID（与 issueId 互斥，至少传一个）",
          },
          issueId: {
            type: "string",
            description:
              "Issue UUID or identifier (e.g. 'HAT-192') to link the document to. " +
              "Mutually exclusive with projectId — when provided, projectId is ignored.",
          },
        },
        required: ["title", "content"],
      },
    },
    {
      name: "list_documents",
      description: "List documents in a Linear project",
      inputSchema: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Project UUID",
          },
          limit: {
            type: "integer",
            description: "Max results (default 25)",
          },
        },
        required: ["projectId"],
      },
    },
    {
      name: "delete_document",
      description: "Delete a document",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Document UUID",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "update_document",
      description: "Update a document's title or content",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Document UUID",
          },
          title: {
            type: "string",
            description: "New title",
          },
          content: {
            type: "string",
            description: "New content (Markdown)",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "search_issues",
      description: "Search issues by title with optional filters",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (matches issue title, case-insensitive)",
          },
          team: {
            type: "string",
            description: "Team UUID filter",
          },
          project: {
            type: "string",
            description: "Project name filter",
          },
          assignee: {
            type: "string",
            description: '"me" or user UUID',
          },
          state: {
            type: "string",
            description: "State name filter",
          },
          limit: {
            type: "number",
            description: "Max results (default 25)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "list_comments",
      description: "List comments on an issue",
      inputSchema: {
        type: "object",
        properties: {
          issueId: {
            type: "string",
            description: 'Issue UUID or identifier (e.g. "HAT-155")',
          },
          limit: {
            type: "number",
            description: "Max results (default 25)",
          },
        },
        required: ["issueId"],
      },
    },
    {
      name: "get_comment",
      description: "Get a single comment by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Comment UUID",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "list_attachments",
      description: "List attachments on an issue",
      inputSchema: {
        type: "object",
        properties: {
          issueId: {
            type: "string",
            description: "Issue UUID",
          },
          limit: {
            type: "number",
            description: "Max results (default 25)",
          },
        },
        required: ["issueId"],
      },
    },
    {
      name: "create_attachment",
      description: "Create an attachment (URL) on an issue",
      inputSchema: {
        type: "object",
        properties: {
          issueId: {
            type: "string",
            description: "Issue UUID",
          },
          url: {
            type: "string",
            description: "Attachment URL",
          },
          title: {
            type: "string",
            description: "Optional attachment title",
          },
        },
        required: ["issueId", "url"],
      },
    },
    {
      name: "archive_issue",
      description: "Archive an issue",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Issue UUID",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "list_teams",
      description: "List all teams",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "list_projects",
      description: "List projects, optionally filtered by team",
      inputSchema: {
        type: "object",
        properties: {
          team: {
            type: "string",
            description: "Team name filter",
          },
          limit: {
            type: "number",
            description: "Max results (default 25)",
          },
        },
      },
    },
    {
      name: "create_project",
      description:
        "Create a fully-populated project (icon, color, description, overview content, dates, lead/members, status, and milestones)",
      inputSchema: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Team UUID" },
          name: { type: "string", description: "Project name" },
          icon: {
            type: "string",
            description: 'Linear icon name (e.g. "FaceMonocle") or an emoji',
          },
          color: { type: "string", description: 'Hex color, e.g. "#f2994a"' },
          description: { type: "string", description: "One-line summary" },
          content: { type: "string", description: "Overview body (Markdown)" },
          statusId: { type: "string", description: "Project status UUID" },
          leadId: { type: "string", description: "Lead user UUID" },
          memberIds: {
            type: "array",
            items: { type: "string" },
            description: "Member user UUIDs",
          },
          startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
          targetDate: { type: "string", description: "Target date (YYYY-MM-DD)" },
          priority: {
            type: "number",
            description: "0=None, 1=Urgent, 2=High, 3=Normal, 4=Low",
          },
          milestones: {
            type: "array",
            description: "Milestones to create in order",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Milestone name" },
                description: { type: "string", description: "Optional description" },
                targetDate: {
                  type: "string",
                  description: "Optional target date (YYYY-MM-DD)",
                },
              },
              required: ["name"],
            },
          },
        },
        required: ["teamId", "name"],
      },
    },
    {
      name: "update_project",
      description:
        "Update a project's fields (name, icon, color, description, content, dates, lead/members, status, priority)",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Project UUID" },
          name: { type: "string", description: "New project name" },
          icon: {
            type: "string",
            description: 'Linear icon name (e.g. "FaceMonocle") or an emoji',
          },
          color: { type: "string", description: 'Hex color, e.g. "#f2994a"' },
          description: { type: "string", description: "One-line summary" },
          content: { type: "string", description: "Overview body (Markdown)" },
          statusId: { type: "string", description: "Project status UUID" },
          leadId: { type: "string", description: "Lead user UUID" },
          memberIds: {
            type: "array",
            items: { type: "string" },
            description: "Member user UUIDs",
          },
          startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
          targetDate: { type: "string", description: "Target date (YYYY-MM-DD)" },
          priority: {
            type: "number",
            description: "0=None, 1=Urgent, 2=High, 3=Normal, 4=Low",
          },
        },
        required: ["id"],
      },
    },
  ],
}));

// ── CallTool Handler ──────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_issue": {
        const result = await getIssue(
          args as { id: string; comments?: boolean; sub_issues?: boolean },
          graphql,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "list_issues": {
        const result = await listIssues(
          args as {
            project?: string;
            assignee?: string;
            state?: string;
            parentId?: string;
            priority?: number;
            query?: string;
            limit?: number;
          },
          graphql,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "get_status_map": {
        const result = await getStatusMap(
          args as { team: string; refresh?: boolean; expect?: string },
          graphql,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_issue": {
        const result = await updateIssue(
          args as {
            id: string;
            title?: string;
            description?: string;
            state?: string;
            assignee?: string;
            priority?: number;
            parentId?: string | null;
          },
          graphql,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_issue": {
        const result = await createIssue(
          args as {
            teamId: string;
            title: string;
            description?: string;
            projectId?: string;
            state?: string;
            assignee?: string;
            priority?: number;
          },
          graphql,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_comment": {
        const result = await createComment(args as { issueId: string; body: string }, graphql);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_document": {
        const result = await createDocument(
          args as { title: string; content: string; projectId?: string; issueId?: string },
          graphql,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "list_documents": {
        const result = await listDocuments(args as { projectId: string; limit?: number }, graphql);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "delete_document": {
        const result = await deleteDocument(args as { id: string }, graphql);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_document": {
        const result = await updateDocument(
          args as { id: string; title?: string; content?: string },
          graphql,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "search_issues": {
        const result = await searchIssues(
          args as {
            query: string;
            team?: string;
            project?: string;
            assignee?: string;
            state?: string;
            limit?: number;
          },
          graphql,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "list_comments": {
        const result = await listComments(args as { issueId: string; limit?: number }, graphql);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "get_comment": {
        const result = await getComment(args as { id: string }, graphql);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "list_attachments": {
        const result = await listAttachments(args as { issueId: string; limit?: number }, graphql);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_attachment": {
        const result = await createAttachment(
          args as { issueId: string; url: string; title?: string },
          graphql,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "archive_issue": {
        const result = await archiveIssue(args as { id: string }, graphql);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "list_teams": {
        const result = await listTeams({} as Record<string, never>, graphql);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "list_projects": {
        const result = await listProjects(args as { team?: string; limit?: number }, graphql);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_project": {
        // 双重断言：MCP 的 args 是 Record<string,unknown>|undefined，与含必需字段的
        // CreateProjectArgs 无足够重叠，TS 需经 unknown 才允许断言（入参已由 inputSchema 校验）。
        const result = await createProject(args as unknown as CreateProjectArgs, graphql);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_project": {
        // 双重断言同上（见 create_project）。
        const result = await updateProject(args as unknown as UpdateProjectArgs, graphql);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return {
      content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
      isError: true,
    };
  }
});

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("@hatcloud/linear-mcp started");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
