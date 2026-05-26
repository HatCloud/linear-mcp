## Overview

为 linear-mcp MCP 服务器新增三个文档管理工具：`list_documents`、`delete_document`、`update_document`，使 Claude 能够通过 MCP 完整管理 Linear 项目下的文档（CRUD），补全现有 `create_document` 工具的缺失操作。

## Goals / Non-Goals

- **Goals**:
  - 新增 `list_documents(projectId, limit?)` — 列出项目下的文档
  - 新增 `delete_document(id)` — 删除指定文档
  - 新增 `update_document(id, title?, content?)` — 更新文档标题或内容
  - 工具风格、错误处理与现有工具完全一致
  - 每个新工具有对应的 Vitest 单元测试

- **Non-Goals**:
  - 不支持按 issue 列出文档（仅支持按项目）
  - 不暴露 `icon`、`color` 等次要字段
  - 不修改现有工具的行为

## Architecture

三个独立工具文件，各自内联 GraphQL，通过 `GraphQLFn` 接口与客户端解耦。server.ts 注册工具定义并分发 handler，与现有 17 个工具的组织方式完全一致。

**新增文件：**
- `src/tools/list-documents.ts` — 通过 `project { documents }` 嵌套查询获取文档列表
- `src/tools/delete-document.ts` — `documentDelete(id)` mutation
- `src/tools/update-document.ts` — `documentUpdate(id, input)` mutation
- `test/unit/list-documents.test.ts`
- `test/unit/delete-document.test.ts`
- `test/unit/update-document.test.ts`

**修改文件：**
- `src/server.ts` — 新增 3 个 import + 3 个工具定义 + 3 个 case 分支

**不需要修改：**
- `src/graphql.ts`（GraphQL 客户端通用，无需改动）
- `src/types.ts`（三个工具的返回类型简单，直接在工具文件内声明即可）

## GraphQL

```graphql
# list_documents — UNVERIFIED: assumes project.documents(first:) supports pagination
query ListDocuments($projectId: String!, $limit: Int!) {
  project(id: $projectId) {
    documents(first: $limit) {
      nodes { id title url updatedAt }
    }
  }
}

# delete_document — UNVERIFIED: mutation name assumed from Linear naming patterns
mutation DeleteDocument($id: String!) {
  documentDelete(id: $id) {
    success
  }
}

# update_document — UNVERIFIED: signature (id, input) assumed from projectUpdate pattern
mutation UpdateDocument($id: String!, $input: DocumentUpdateInput!) {
  documentUpdate(id: $id, input: $input) {
    success
    document { id title url }
  }
}
```

**注意**：`update_document` 的 `content` 参数与 `create_document` 一致，实现时做 `\\n → \n` 正规化。

## Error Handling

与现有工具完全一致：
- mutation 返回 `success: false` → throw Error
- mutation 返回 `success: true` 但无 document 对象 → throw Error（仅 update_document）
- `list_documents` 若 project 不存在 → throw Error（`project` 字段为 null）

## Success Criteria

- `npx tsc --noEmit` 通过
- `npm run build && npm test` 全部通过
- 在 Claude 中调用三个工具可以正确列出、删除、更新 Linear 文档

## Acceptance Tests

- [MUST] `npm test` 新增的 3 个测试文件全部通过
- [MUST] `npx tsc --noEmit` 类型检查通过
- [MUST] `npm run build` 构建成功
- [MUST] 手动调用 `list_documents(projectId: "a368ff68-...")` 返回 Claude Settings 项目文档列表
- [SHOULD] 手动调用 `delete_document(id: "<test-doc-id>")` 删除指定文档返回 `{ success: true }`
- [SHOULD] 手动调用 `update_document(id: "...", title: "新标题")` 更新成功

## Execution Strategy

- **Preset**: Lite
- **Execution mode**: inline
- **Phase merge**: none

## Review Strategy

- **Complexity**: Low
- **Design review rounds**: 0（Lite preset）
- **Code review level**: light
