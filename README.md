# @hatcloud/linear-mcp

Custom Linear MCP Server with optimized GraphQL queries for AI context efficiency.

## Why?

The official Linear MCP returns full issue objects. This server uses targeted GraphQL field selection, reducing context usage by ~80%.

## Installation

Add to your MCP config (`~/.claude/mcp.json` or equivalent):

```json
{
  "linear": {
    "command": "npx",
    "args": ["-y", "@hatcloud/linear-mcp"],
    "env": {
      "LINEAR_API_KEY": "lin_api_your_key_here"
    }
  }
}
```

## Tools

20 tools covering issues, comments, documents, attachments, projects, and teams.

**Issues**

| Tool | Description |
|------|-------------|
| `get_issue` | Full issue details with optional comments and sub-issues (single compound query) |
| `list_issues` | List issues with filters (project, assignee, state, parent, priority, title) |
| `search_issues` | Search issues by title with optional filters |
| `create_issue` | Create a new issue |
| `update_issue` | Update any field of an existing issue |
| `archive_issue` | Archive an issue |
| `get_status_map` | Map status names to UUIDs for a team |

**Comments**

| Tool | Description |
|------|-------------|
| `list_comments` | List comments on an issue |
| `get_comment` | Get a single comment by ID |
| `create_comment` | Add a comment to an issue |

**Documents**

| Tool | Description |
|------|-------------|
| `list_documents` | List documents in a project |
| `create_document` | Create a document, optionally linked to an issue |
| `update_document` | Update a document's title or content |
| `delete_document` | Delete a document |

**Attachments**

| Tool | Description |
|------|-------------|
| `list_attachments` | List attachments on an issue |
| `create_attachment` | Create a URL attachment on an issue |

**Projects & Teams**

| Tool | Description |
|------|-------------|
| `list_teams` | List all teams |
| `list_projects` | List projects, optionally filtered by team |
| `create_project` | Create a new project |
| `update_project` | Update a project |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LINEAR_API_KEY` | Yes | Your Linear API key (from Linear Settings → API) |

## Development

```bash
npm test          # Run unit tests
npm run build     # Build to dist/
```
