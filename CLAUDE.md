# linear-mcp

Linear MCP Server — 为 Claude 等 AI 助手提供 Linear 项目管理工具的 MCP 服务。

## 技术栈

- TypeScript: 5.x (ES2022, Node16 模块)
- MCP SDK: @modelcontextprotocol/sdk ^1.5.0
- 构建: tsup
- 测试: Vitest 4.x
- 格式化: Prettier（`npm run format` 写入 / `npm run format:check` 校验，配置见 `.prettierrc`）

## 验证命令

- 轻量（开发中每个 task 后）: `npx tsc --noEmit`
- 完整（任务结束时）: `npm run build && npm test`

## 关键约定

- 入口文件为 `src/server.ts`，GraphQL 查询集中在 `src/graphql.ts`
- 类型定义集中在 `src/types.ts`（各工具的 args 接口就近定义在 `src/tools/<tool>.ts` 内）
- `get_status_map` 的团队状态映射经 `src/status-cache.ts` 磁盘缓存（`~/.cache/linear-mcp/<apiKeyHash>/status-map`）：正常命中缓存，仅在 `expect` 未命中 / `update_issue` 带 state 提交失败 / `refresh:true` 时回源
- 使用 `.githooks/` 目录管理 git hooks（`core.hooksPath` 通过 `prepare` script 配置）

## Linear 配置

- Team: `HAT` — Hat Studio（`cac83401-25ca-461e-aec8-e9cb7a16caef`）
- Project: `linear-mcp`（`9e3fda16-aeba-4ad0-8319-6ddd8078e933`）
  https://linear.app/hatcloud/project/linear-mcp-35d03707294c
