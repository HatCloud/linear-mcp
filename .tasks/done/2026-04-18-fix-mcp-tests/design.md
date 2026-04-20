## Overview
修复 Linear MCP 中 3 个已确认的 GraphQL schema 不匹配 bug，排查 2 个疑似问题，用 Vitest 替换自定义测试框架并覆盖全部 17 个工具，配置 git hooks 和 npm 发布流程。

## Goals / Non-Goals
- **Goals**:
  - 修复 list_projects（ProjectFilter + TeamConnection）
  - 修复 list_comments（变量类型 String! → ID!）
  - 修复 list_issues priority 过滤（Int! → Float!）
  - 排查 list_attachments 空数组 + update_issue 读回一致性
  - 引入 Vitest 测试框架，吸收旧测试逻辑
  - Mock 测试覆盖所有 17 个工具接口
  - 集成测试套件（需 API key，可选运行）
  - pre-commit 运行 mock 测试，pre-push 运行完整测试
  - 测试通过后 npm 发布
  - 删除旧测试实现（test/test.ts, test/live.test.ts）
- **Non-Goals**:
  - 不重构工具实现架构
  - 不引入 @linear/sdk
  - 不增加新功能

## Architecture

### Bug 修复

**1. list_projects (`src/tools/list-projects.ts`)**
- filter: `{ team: { name: ... } }` → `{ accessibleTeams: { some: { name: { eq: $teamName } } } }`
- 两处查询的 `teams { id key }` → `teams { nodes { id key } }`
- 更新 RawProject 类型: `teams: Array<{}>` → `teams: { nodes: Array<{}> }`
- 更新响应映射逻辑以适配 `nodes` 层级

**2. list_comments (`src/tools/list-comments.ts`)**
- `$issueId: String!` → `$issueId: ID!`

**3. list_issues priority (`src/tools/list-issues.ts`)**
- `$priority: Int!` → `$priority: Float!`

**4. list_attachments (`src/tools/list-attachments.ts`)**
- Schema 验证 `$issueId: String!` 是正确的（`issue(id: String!)`）
- 空数组可能是 API 数据行为问题，通过集成测试验证
- 如集成测试确认有问题再修

**5. update_issue (`src/tools/update-issue.ts`)**
- Schema 验证 `$id: String!` 是正确的
- 读回不一致可能是 Linear API 最终一致性
- 建议：mutation 返回值已包含更新后的 issue，下游消费者应优先使用 mutation response
- 通过集成测试验证实际行为

### 测试框架

**选型：Vitest**
- 原因：原生 ESM + TypeScript 支持，与项目的 tsup 构建链兼容，watch 模式，零配置
- Mock 策略：vi.fn() 创建 mock GraphQL 函数，验证 query 构造和响应转换

**测试结构：**
```
test/
├── unit/                    # Mock 测试（无需网络）
│   ├── list-projects.test.ts
│   ├── list-comments.test.ts
│   ├── list-issues.test.ts
│   ├── list-attachments.test.ts
│   ├── update-issue.test.ts
│   ├── get-issue.test.ts
│   ├── list-teams.test.ts
│   ├── get-status-map.test.ts
│   ├── search-issues.test.ts
│   ├── create-issue.test.ts
│   ├── create-comment.test.ts
│   ├── create-attachment.test.ts
│   ├── archive-issue.test.ts
│   ├── create-document.test.ts
│   ├── get-comment.test.ts
│   ├── create-project.test.ts
│   └── update-project.test.ts
├── integration/             # 集成测试（需 LINEAR_API_KEY）
│   └── api.test.ts          # 全部接口的端到端测试
└── setup.ts                 # 共享 mock 工具 + 测试辅助函数
```

**吸收旧测试：**
- test/test.ts 中的 mock 响应数据和断言逻辑迁移到对应的 unit/*.test.ts
- test/live.test.ts 中的 MCP 集成测试逻辑迁移到 integration/api.test.ts
- 完成后删除 test/test.ts 和 test/live.test.ts

**Mock 测试覆盖点（每个工具）：**
1. GraphQL query/mutation 字符串正确性（变量类型、字段名）
2. 变量传递正确性
3. 响应转换逻辑（字段映射、展平、重命名）
4. 边界条件（limit 校验、空响应、可选参数）

### Git Hooks

**工具：直接配置 git core.hooksPath**
- 创建 `.githooks/pre-commit`：运行 `npm test`（unit 测试）
- 创建 `.githooks/pre-push`：运行 `npm test`（unit 测试，集成测试因需要 API key 不在 hook 中运行）
- package.json 添加 `prepare` 脚本：`git config core.hooksPath .githooks`
- `npm install` 后自动配置 hooks 路径
- 集成测试通过 `npm run test:integration` 手动运行（需 LINEAR_API_KEY）

### npm 发布

- package.json `prepublishOnly` 已有 `npm run build`
- 在 pre-push hook 中：测试通过后允许 push
- 发布流程：`npm version patch && npm publish`（手动触发）
- 版本号策略沿用现有方式

### Vitest 配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
  },
});
```

**npm scripts：**
- `test` → `vitest run test/unit/`（unit 测试，pre-commit 使用）
- `test:integration` → `vitest run test/integration/`（集成测试，需 LINEAR_API_KEY）
- `test:all` → `vitest run`（全部测试，pre-push 使用）

## Success Criteria
1. `npm test` 全部通过（17 个工具文件各至少 1 个测试）
2. list_projects、list_comments、list_issues priority 的 bug 修复在 mock 测试中验证
3. `npm run test:integration`（有 API key 时）验证端到端行为
4. `git commit` 触发 pre-commit hook 运行 unit 测试
5. `git push` 触发 pre-push hook 运行 unit 测试
6. 旧测试文件已删除
7. `npm publish --dry-run` 构建成功、包结构正确

## Acceptance Tests
- 运行 `npm test` → 全部 PASS，覆盖 17 个工具
- 运行 `npm run test:integration`（带 LINEAR_API_KEY）→ 关键接口 PASS
- 创建测试 commit → pre-commit hook 自动运行 unit 测试
- 尝试 push → pre-push hook 自动运行完整测试
- 运行 `npm publish --dry-run` → 构建成功、包结构正确
- 验证 list_projects 可按 team 过滤并返回正确数据
- 验证 list_comments 可返回 issue 的评论列表
- 验证 list_issues priority=2 过滤不报错
- 运行 `npm run test:integration`（带 API key）→ 验证 list_attachments 返回行为并记录结论
- 运行 `npm run test:integration`（带 API key）→ 验证 update_issue 回读一致性并记录结论

## Review Strategy
- Design review: 1 轮（Medium 复杂度）
- Code review: Medium
- Reviewer type: Claude Sonnet

## Out of Scope
- CI/CD 流水线配置
- 代码覆盖率指标要求
- 性能基准测试
- 其他未提及的 GraphQL schema 变更排查
