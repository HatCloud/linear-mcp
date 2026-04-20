# Unattended Decisions

## Bug 修复方案（基于 Linear GraphQL Schema 验证）

### 1. list_projects — 需修复
- `filter: { team: ... }` → `filter: { accessibleTeams: { some: { name: { eq: $teamName } } } }`
- `teams { id key }` → `teams { nodes { id key } }`（两处查询都要改）
- TypeScript 类型 `RawProject.teams` 需从 `Array<{}>` 改为 `{ nodes: Array<{}> }`
- **置信度**: High（有 schema 原文确认）

### 2. list_comments — 需修复
- `$issueId: String!` → `$issueId: ID!`
- **置信度**: High

### 3. list_issues priority — 需修复
- `$priority: Int!` → `$priority: Float!`
- Linear schema 中所有 NumberComparator 统一用 Float
- **置信度**: High

### 4. list_attachments — 不需要改类型
- `$issueId: String!` 是正确的（`issue(id: String!)` 在 schema 中）
- 空数组问题可能是数据问题或 API 行为，非代码 bug
- **置信度**: Medium — 需要集成测试验证

### 5. update_issue — 不需要改类型
- `$id: String!` 是正确的
- 读回不一致可能是 Linear API 最终一致性，建议使用 mutation 返回值
- **置信度**: Medium

## 额外需求
- 用户要求测试通过后进行 npm 发布
- pre-commit 运行 mock 测试，pre-push 运行完整测试
