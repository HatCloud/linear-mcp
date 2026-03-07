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

| Tool | Description |
|------|-------------|
| `get_issue` | Full issue details with optional comments and sub-issues (single compound query) |
| `list_issues` | Filter issues by project, assignee, state, parent |
| `get_status_map` | Map status names to UUIDs for a team |
| `update_issue` | Update any issue field dynamically |
| `create_issue` | Create a new issue |
| `create_comment` | Add a comment to an issue |
| `create_document` | Create a document in Linear, optionally linked to an issue |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LINEAR_API_KEY` | Yes | Your Linear API key (from Linear Settings → API) |

## Development

```bash
npm test          # Run unit tests
npm run build     # Build to dist/
```
