# Task Completion Report

**Task**: 2026-05-26-linear-mcp-docs
**Completed**: 2026-05-26
**Status**: Completed

## What Was Built

对照 design.md 成功标准：

- ✅ `list_documents(projectId, limit?)` — `src/tools/list-documents.ts`，通过 `project { documents(first: N) }` 嵌套查询返回文档数组（id/title/url/updatedAt）
- ✅ `delete_document(id)` — `src/tools/delete-document.ts`，`documentDelete` mutation，返回 `{ success: true }` 或抛出错误
- ✅ `update_document(id, title?, content?)` — `src/tools/update-document.ts`，`documentUpdate` mutation，支持部分更新、`\\n→\n` 正规化、空输入验证
- ✅ `src/server.ts` 注册了 3 个工具定义和 3 个 handler case
- ✅ 15 个新增单元测试（list×5 / delete×3 / update×7），全部通过
- ✅ `npm run build && npm test`：103/103 通过

## Problems Encountered

1. **空输入 bug（代码 review Issue 1）**
   - 问题：`update_document` 未传 title/content 时仍调用 GraphQL，发送空 input
   - 解决：在构建 input 后添加 `Object.keys(input).length === 0` 守卫，提前抛出 `"updateDocument requires at least one of: title, content"`
   - 教训：tool 函数的入参验证应在函数入口而非依赖 GraphQL server 报错

2. **limit 类型 mismatch（代码 review Issue 3）**
   - 问题：server.ts tool schema 中 limit 定义为 `"type": "number"`，而 GraphQL 变量是 `Int!`（不接受 float）
   - 解决：改为 `"type": "integer"`
   - 教训：JSON Schema 中 `"number"` 允许浮点，MCP 传给 GraphQL `Int!` 时需用 `"integer"`

3. **缺少空输入测试用例（代码 review Issue 2）**
   - 问题：update-document.test.ts 初版未覆盖空输入抛错场景
   - 解决：补充 `it("throws when neither title nor content is provided", ...)` 测试

## Deviations from Plan

| 原始 | 实际 | 原因 |
|------|------|------|
| server.ts 中 limit 类型 `"number"` | 改为 `"integer"` | 代码 review 发现与 `Int!` GraphQL 变量不匹配 |
| plan.md Task 4 未指定空输入测试 | update-document.test.ts 多一个测试（共 7 条） | 代码 review 补充边界覆盖 |

## Verification

- [x] `npm run build` 通过（dist/server.js 39.21 KB）
- [x] `npm test` 103/103 通过
- [x] `npx tsc --noEmit` NOT_APPLICABLE（test/integration/api.test.ts 有 3 个预存在错误，git stash 确认非本任务引入）
- [x] 验收清单（acceptance-checklist.md）：机判 MUST 项全部 PASS；手动项 DEFERRED（self_test 模式）

## Changelog Entry

- **2026-05-26**: feat(server): add list_documents, delete_document, update_document MCP tools [HAT-436]

## Follow-up Suggestions

- 修复 `test/integration/api.test.ts` 中 3 个预存在 TypeScript 错误（独立 task，低优先级）
- 端到端验证三个新工具对接真实 Linear API（DEFERRED，见 acceptance-checklist.md）

## Consumption Summary

| Phase | Duration | Output Tokens | Cache Read | Tool Calls |
|-------|----------|---------------|------------|------------|
| P1:Init | 35m | 101.9K | 9.6M | 49 |
| P2:Design | 1.5h | 312.8K | 46.7M | 90 |
| P3:Plan | 10m | 103.4K | 21.5M | 36 |
| P4:Execute | 16m | 270.5K | 91.8M | 120 |
| P5:Test | 2m | — | — | — |
| P6:End | — | — | — | — |
| **总计** | — | **798.2K** | **170.0M** | **298** |

Cache 命中率: 99%（uncached input 仅 20.5K / 170.0M cache read）

**改进建议**：
1. P2:Design 消耗 39% 的 output tokens（312.8K），主要由 Self-Discussion subagent 和逐节 review 驱动——Lite 档位已是最轻量，可接受
2. Edit 工具调用 84 次均值 1287 tokens——server.ts 体积较大导致每次编辑输出较多上下文，下次可提取常量减少重复读取
3. TaskCreate 31 次均值 2086 tokens——TODO sync 开销较高，无人值守模式可考虑减少 step 粒度
