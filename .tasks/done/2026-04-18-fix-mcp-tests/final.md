# Task Completion Report

**Task**: 2026-04-18-fix-mcp-tests
**Completed**: 2026-04-20
**Status**: Completed

## What Was Built

1. **修复 list_projects GraphQL 查询**
   - `filter: { team: ... }` → `filter: { accessibleTeams: { some: { name: ... } } }`
   - `teams { id key }` → `teams { nodes { id key } }`
   - 更新了 `RawProject` 接口和响应映射逻辑

2. **修复 list_comments 变量类型**
   - `$issueId: String!` → `$issueId: ID!`

3. **修复 list_issues priority 过滤类型**
   - `$priority: Int!` → `$priority: Float!`

4. **排查结论**
   - list_attachments: `$issueId: String!` 在 schema 中是正确的，空数组可能是 API 行为
   - update_issue: `$id: String!` 正确，回读不一致可能是 Linear API 最终一致性

5. **Vitest 测试框架**
   - 17 个 unit 测试文件，88 个测试用例
   - 集成测试套件（需 LINEAR_API_KEY）
   - 共享 mock 工具 (`test/setup.ts`)

6. **Git Hooks**
   - `.githooks/pre-commit` 和 `.githooks/pre-push` 运行 unit 测试
   - `prepare` 脚本自动配置 `core.hooksPath`（仅在 git 仓库中生效）

7. **旧测试删除**
   - 移除 `test/test.ts`（自定义 harness）和 `test/live.test.ts`

## Problems Encountered

1. **Vitest workspace 配置复杂度**: 最初设计使用 `--project` 分区，review 指出与 vitest.config.ts 不匹配。简化为路径参数方式。
2. **prepare 脚本影响 npm 消费者**: code review 发现 `prepare` 会在所有 `npm install` 时运行。修复为 `test -d .git && ... || true`。
3. **集成测试状态依赖**: 写操作测试依赖前序测试创建的 ID，若前序失败会导致后续误报。添加 `expect(id).toBeDefined()` 守卫。

## Deviations from Plan

| 原始 | 实际 | 原因 |
|------|------|------|
| `captureVariables()` 函数 | `lastCall()` / `nthCall()` 函数 | 更直观的 API |
| 19 个工具文件 | 17 个工具文件 | 实际统计修正 |
| pre-push 运行全部测试 | pre-push 运行 unit 测试 | 集成测试需 API key，不适合 hook |
| Task 1 使用 Full TDD | 直接配置 | 基础设施不适合 TDD 格式 |

## Verification

- [x] `npm test` — 17 files, 88 tests PASS
- [x] `npm run build` — dist/server.js 35.34 KB
- [x] `npm publish --dry-run` — 包结构正确（3 files, 8.0 kB）
- [x] pre-commit hook 自动运行测试（commit 时已验证）
- [x] 旧测试文件已删除

## Follow-up Suggestions

1. 运行集成测试（`LINEAR_API_KEY=xxx npm run test:integration`）验证 list_attachments 和 update_issue 的实际行为
2. 版本号需要 bump 才能发布（当前 1.2.1 已发布）
3. 可考虑添加 CI/CD 自动运行测试
