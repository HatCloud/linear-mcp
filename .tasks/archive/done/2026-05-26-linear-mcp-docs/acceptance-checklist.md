# Acceptance Checklist

**Task**: 2026-05-26-linear-mcp-docs
**Generated**: 2026-05-26 00:10

## Round 1

### 自动化测试（已预填，无需修改）

1. [MUST] `npm test` 新增的 3 个测试文件全部通过
   → PASS（103/103 tests passed，含 list-documents×5、delete-document×3、update-document×7）

2. [MUST] `npx tsc --noEmit` 类型检查通过
   → NOT_APPLICABLE（test/integration/api.test.ts 中存在 3 个预存在 TS 错误，git stash 证实本次变更引入前已存在，非本任务引入；tsup build 成功）

3. [MUST] `npm run build` 构建成功
   → PASS（dist/server.js 39.21 KB，build success in 29ms）

### 手动测试（self_test 模式跳过）

> 无人值守 self_test 模式：手动调用项无法机判，记录为 deferred，不阻断。

4. [MUST] 手动调用 `list_documents(projectId: "a368ff68-...")` 返回 Claude Settings 项目文档列表
   → DEFERRED（self_test 模式，需人工验证）

5. [SHOULD] 手动调用 `delete_document(id: "<test-doc-id>")` 删除指定文档返回 `{ success: true }`
   → DEFERRED（self_test 模式，需人工验证）

6. [SHOULD] 手动调用 `update_document(id: "...", title: "新标题")` 更新成功
   → DEFERRED（self_test 模式，需人工验证）

### 追加修改（可选）

-
