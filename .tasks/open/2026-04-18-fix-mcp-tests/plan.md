# Fix Linear MCP Bugs + Unit Tests Implementation Plan

**Design**: design.md
**Complexity**: Medium
**Tasks**: 8

## Verification Commands
- Light: `npx vitest run test/unit/ --reporter=verbose 2>&1 | tail -5`
- Full: `npm test && npm run build`

## Task 1: Setup Vitest Infrastructure

**Files**: Create `vitest.config.ts`, Modify `package.json`, Create `test/setup.ts`

### Steps
- [ ] 安装 Vitest: `npm install -D vitest`
- [ ] 创建 `vitest.config.ts` — `defineConfig({ test: { environment: 'node', globals: false } })`
- [ ] 创建 `test/setup.ts` — 导出共享 mock GraphQL 函数工厂:
  - `createMockGraphQL(responses: Record<string, any>)` — 根据 query 关键词匹配返回对应 mock 响应
  - `captureVariables(mockFn)` — 返回最近一次调用传入的 variables
- [ ] 更新 `package.json` scripts:
  - `"test": "vitest run test/unit/"`
  - `"test:integration": "vitest run test/integration/"`
  - `"test:all": "vitest run"`
  - `"prepare": "git config core.hooksPath .githooks"`
- [ ] VERIFY: `npx vitest --version` → 返回版本号

### Verification
- `npx vitest --version` 返回版本号
- `vitest.config.ts` 存在
- `test/setup.ts` 导出 `createMockGraphQL` 和 `captureVariables`

## Task 2: Fix list_projects GraphQL Query

**Files**: Modify `src/tools/list-projects.ts`

### Steps
- [ ] RED: 创建 `test/unit/list-projects.test.ts` — 测试用例:
  1. 按 team 过滤时 query 包含 `accessibleTeams: { some: { name: { eq: $teamName } } }`
  2. query 包含 `teams { nodes { id key } }`
  3. 响应正确映射 `teams.nodes` 到 `teams` 数组
- [ ] RED-VERIFY: `npx vitest run test/unit/list-projects.test.ts` → FAIL
- [ ] GREEN: 修改 `src/tools/list-projects.ts`:
  - 行 37: `filter: { team: { name: { eq: $teamName } } }` → `filter: { accessibleTeams: { some: { name: { eq: $teamName } } } }`
  - 行 44-46: `teams { id key }` → `teams { nodes { id key } }`（两处查询都改）
  - 更新 `RawProject` 接口: `teams: Array<{id:string;key:string}>` → `teams: { nodes: Array<{id:string;key:string}> }`
  - 更新响应映射: `p.teams` → `p.teams.nodes`
- [ ] GREEN-VERIFY: `npx vitest run test/unit/list-projects.test.ts` → PASS
- [ ] REFACTOR: 检查无冗余代码 → `npx vitest run test/unit/list-projects.test.ts` → 仍 PASS

### Verification
- `npx vitest run test/unit/list-projects.test.ts` 全部 PASS

## Task 3: Fix list_comments + list_issues Priority Type

**Files**: Modify `src/tools/list-comments.ts`, Modify `src/tools/list-issues.ts`

### Steps
- [ ] RED: 创建 `test/unit/list-comments.test.ts` — 测试用例:
  1. query 变量声明包含 `$issueId: ID!`（非 `String!`）
  2. 响应正确映射 comment 字段
- [ ] RED: 创建 `test/unit/list-issues.test.ts` — 测试用例:
  1. priority 过滤时 query 包含 `$priority: Float!`（非 `Int!`）
  2. 响应正确转换 priority 字段
  3. assignee/state/project 等其他过滤条件正常工作
  4. limit 校验（min 1, max 50, default 25）
- [ ] RED-VERIFY: `npx vitest run test/unit/list-comments.test.ts test/unit/list-issues.test.ts` → FAIL
- [ ] GREEN: 修改 `src/tools/list-comments.ts` 行 29: `$issueId: String!` → `$issueId: ID!`
- [ ] GREEN: 修改 `src/tools/list-issues.ts` 行 181: `"$priority: Int!"` → `"$priority: Float!"`
- [ ] GREEN-VERIFY: `npx vitest run test/unit/list-comments.test.ts test/unit/list-issues.test.ts` → PASS

### Verification
- `npx vitest run test/unit/list-comments.test.ts test/unit/list-issues.test.ts` 全部 PASS

## Task 4: Unit Tests for Read Tools

**Files**: Create `test/unit/get-issue.test.ts`, `test/unit/list-teams.test.ts`, `test/unit/get-status-map.test.ts`, `test/unit/search-issues.test.ts`, `test/unit/list-attachments.test.ts`, `test/unit/get-comment.test.ts`

### Steps
- [ ] RED: 创建 `test/unit/get-issue.test.ts` — 测试用例:
  1. 响应转换: labels.nodes → labels 数组
  2. 响应转换: priority + priorityLabel → priority 对象
  3. 可选字段: comments 展开 + user.displayName → author
  4. 可选字段: children → subIssues
- [ ] RED: 创建 `test/unit/list-teams.test.ts` — 测试用例:
  1. query 结构正确
  2. 响应映射正确（返回 {id, key} 数组）
- [ ] RED: 创建 `test/unit/get-status-map.test.ts` — 测试用例:
  1. team key → UUID 解析逻辑
  2. 状态映射构建: name → UUID map + all 列表
  3. 大小写不敏感匹配
- [ ] RED: 创建 `test/unit/search-issues.test.ts` — 测试用例:
  1. query 包含 title containsIgnoreCase 过滤
  2. team/project/assignee/state 过滤条件正确传递
- [ ] RED: 创建 `test/unit/list-attachments.test.ts` — 测试用例:
  1. query 结构正确（通过 issue node 查询 attachments）
  2. 响应映射正确
- [ ] RED: 创建 `test/unit/get-comment.test.ts` — 测试用例:
  1. query 结构正确
  2. 响应映射 user.displayName → author
- [ ] 对每个测试文件: 导入对应工具函数，用 `createMockGraphQL` 构造 mock（mock 数据结构从 `src/tools/*.ts` 中 GraphQL 响应字段读取），调用工具函数，用 `expect()` 断言输出结构
- [ ] VERIFY: `npx vitest run test/unit/get-issue.test.ts test/unit/list-teams.test.ts test/unit/get-status-map.test.ts test/unit/search-issues.test.ts test/unit/list-attachments.test.ts test/unit/get-comment.test.ts` → 全部 PASS

### Verification
- 6 个测试文件全部 PASS

## Task 5: Unit Tests for Write Tools

**Files**: Create `test/unit/create-issue.test.ts`, `test/unit/update-issue.test.ts`, `test/unit/create-comment.test.ts`, `test/unit/create-attachment.test.ts`, `test/unit/archive-issue.test.ts`, `test/unit/create-document.test.ts`, `test/unit/create-project.test.ts`, `test/unit/update-project.test.ts`

### Steps
- [ ] RED: 创建 `test/unit/create-issue.test.ts` — 测试用例:
  1. mutation 变量包含 teamId + title（必填）
  2. 可选字段（description, priority, assigneeId）正确传递
  3. description `\\n` → `\n` 转换
- [ ] RED: 创建 `test/unit/update-issue.test.ts` — 测试用例:
  1. 仅传递实际提供的字段到 input
  2. state → stateId 映射
  3. priority 类型为 number
- [ ] RED: 创建 `test/unit/create-comment.test.ts` — 测试用例:
  1. mutation 包含 issueId + body
  2. body `\\n` → `\n` 转换
- [ ] RED: 创建 `test/unit/create-attachment.test.ts` — 测试用例:
  1. mutation 包含 issueId + url
  2. 可选 title 正确传递
- [ ] RED: 创建 `test/unit/archive-issue.test.ts` — 测试用例:
  1. mutation 使用 `$id: String!`
  2. 返回 success 字段
- [ ] RED: 创建 `test/unit/create-document.test.ts` — 测试用例:
  1. issueId 为 identifier 时触发 UUID 解析查询
  2. issueId 为 UUID 时直接使用
  3. content `\\n` → `\n` 转换
- [ ] RED: 创建 `test/unit/create-project.test.ts` — 测试用例:
  1. mutation 包含 teamIds 数组 + name
- [ ] RED: 创建 `test/unit/update-project.test.ts` — 测试用例:
  1. mutation 使用 `$id: String!`
  2. input 动态构建
- [ ] 对每个测试文件: 导入对应工具函数，用 `createMockGraphQL` 构造 mock（mock 数据从 `src/tools/*.ts` 中 mutation 响应字段读取），调用工具函数，用 `expect()` 断言返回值和传入变量
- [ ] VERIFY: `npx vitest run test/unit/create-issue.test.ts test/unit/update-issue.test.ts test/unit/create-comment.test.ts test/unit/create-attachment.test.ts test/unit/archive-issue.test.ts test/unit/create-document.test.ts test/unit/create-project.test.ts test/unit/update-project.test.ts` → 全部 PASS

### Verification
- 8 个测试文件全部 PASS

## Task 6: Integration Tests

**Files**: Create `test/integration/api.test.ts`

### Steps
- [ ] RED: 创建 `test/integration/api.test.ts` — 从旧 `test/live.test.ts` 迁移测试逻辑:
  1. list_teams → 返回非空数组
  2. get_status_map → HAT team 有状态映射
  3. list_issues → 按 project 过滤返回结果
  4. search_issues → 按 team 过滤返回结果
  5. get_issue → HAT-155 返回有效数据（未归档的已知 issue）
  6. list_projects → 返回非空数组（验证 bug 修复）
  7. list_comments → 对已有 issue 返回结果（验证 bug 修复）
  8. list_issues priority → priority=2 过滤不报错（验证 bug 修复）
  9. list_attachments → 记录实际行为（排查结论）
  10. create_issue + update_issue + get_issue → 验证回读一致性（排查结论）
  11. 清理: archive 测试 issue
- [ ] RED: 在每个测试前添加 `skipIf(!process.env.LINEAR_API_KEY)` 守卫
- [ ] RED-VERIFY: `npx vitest run test/integration/` → SKIP (无 API key)
- [ ] GREEN: 使用 LINEAR_API_KEY 运行: `LINEAR_API_KEY=$LINEAR_API_KEY npx vitest run test/integration/` → PASS
- [ ] GREEN-VERIFY: 确认所有集成测试结果与预期一致

### Verification
- 无 API key 时: 测试跳过，不报错
- 有 API key 时: 核心读取测试 PASS，排查项有明确结论

## Task 7: Git Hooks + Old Test Cleanup

**Files**: Create `.githooks/pre-commit`, Create `.githooks/pre-push`, Delete `test/test.ts`, Delete `test/live.test.ts`

### Steps
- [ ] RED: `cat .githooks/pre-commit` → 文件不存在
- [ ] RED-VERIFY: 确认 `.githooks/` 目录不存在
- [ ] GREEN: 创建 `.githooks/pre-commit`:
  ```bash
  #!/bin/sh
  npm test
  ```
- [ ] GREEN: 创建 `.githooks/pre-push`:
  ```bash
  #!/bin/sh
  npm test
  ```
- [ ] GREEN: `chmod +x .githooks/pre-commit .githooks/pre-push`
- [ ] 删除 `test/test.ts` 和 `test/live.test.ts`
- [ ] VERIFY: `npm test` → 全部 PASS（删除旧文件不影响新测试）
- [ ] VERIFY: `npx vitest run test/unit/ --reporter=verbose 2>&1 | grep -c "✓"` → 输出 ≥ 17

### Verification
- `.githooks/pre-commit` 和 `.githooks/pre-push` 存在且可执行
- 旧测试文件已删除
- `npm test` 全部 PASS

## Task 8: Acceptance Tests

**Files**: 无新文件

### Steps
- [ ] VERIFY: `npm test` → 全部 PASS，覆盖 17 个工具
- [ ] VERIFY: `npm run build` → 构建成功
- [ ] VERIFY: `npm publish --dry-run` → 包结构正确
- [ ] VERIFY: list_projects unit 测试中 query 包含 `accessibleTeams`
- [ ] VERIFY: list_comments unit 测试中 query 包含 `$issueId: ID!`
- [ ] VERIFY: list_issues unit 测试中 query 包含 `$priority: Float!`

### Verification
- 所有 design.md Acceptance Tests 项目通过
- `npm publish --dry-run` 成功

Self-review checklist: passed
