# Technical Debt — 2026-05-26-linear-mcp-docs

## Pre-existing: TypeScript errors in test/integration/api.test.ts

`npx tsc --noEmit` 输出 3 个错误，全部在 `test/integration/api.test.ts`（非本任务引入）：

1. `(32,27): TS2554` — `Expected 2 arguments, but got 1`（某工具函数签名已改但测试未跟进）
2. `(59,22): TS2561` — `'teamId' does not exist in type 'SearchIssuesArgs'`（字段已重命名为 `team`）
3. `(116,21): TS2339` — `Property 'success' does not exist on type '...'`（返回类型已变更）

**建议**：修复 `test/integration/api.test.ts` 使 tsc 完全通过，独立提交。

## Deferred manual acceptance tests

三个新工具（`list_documents`、`delete_document`、`update_document`）的端到端真实 API 调用（接 Linear 生产环境）在 self_test 模式下未执行，标记为 DEFERRED。建议在实际使用中验证后关闭。
