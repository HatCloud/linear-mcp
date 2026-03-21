// src/server.ts
//
// Linear MCP Server — 入口文件
//
// 将 7 个工具函数组装为一个 MCP server，通过 stdio transport 与客户端通信。
// 启动时读取 LINEAR_API_KEY 环境变量，创建 GraphQL 客户端，注册工具。

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { createGraphQLClient } from "./graphql.js";
import { getIssue } from "./tools/get-issue.js";
import { listIssues } from "./tools/list-issues.js";
import { getStatusMap } from "./tools/get-status-map.js";
import { updateIssue } from "./tools/update-issue.js";
import { createIssue } from "./tools/create-issue.js";
import { createComment } from "./tools/create-comment.js";
import { createDocument } from "./tools/create-document.js";

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
  { capabilities: { tools: {} } }
);

// ── ListTools Handler ─────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_issue",
      description: "Gets full details of a Linear issue (description, comments, sub-issues in one query)",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Issue UUID or identifier like \"HAT-155\"",
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
            description: "\"me\", UUID, or \"null\" for unassigned",
          },
          state: {
            type: "string",
            description: "State name filter (e.g. \"started\", \"In Progress\")",
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
      description: "Gets a map of status names to IDs for a team",
      inputSchema: {
        type: "object",
        properties: {
          team: {
            type: "string",
            description: "Team key (e.g. \"HAT\") or UUID",
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
      description: "Creates a document in Linear belonging to a project, optionally linked to an issue",
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
          graphql
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
          graphql
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "get_status_map": {
        const result = await getStatusMap(
          args as { team: string },
          graphql
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
          graphql
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
          graphql
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_comment": {
        const result = await createComment(
          args as { issueId: string; body: string },
          graphql
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_document": {
        const result = await createDocument(
          args as { title: string; content: string; projectId?: string; issueId?: string },
          graphql
        );
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
