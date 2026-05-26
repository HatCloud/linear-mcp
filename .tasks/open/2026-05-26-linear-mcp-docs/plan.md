# Document CRUD Tools Implementation Plan

**Design**: design.md
**Complexity**: Low
**Tasks**: 5

## Verification Commands
- Light: `npx tsc --noEmit`
- Full: `npm run build && npm test`

## File Structure
- `src/tools/list-documents.ts` — Create — 通过 `project.documents` 嵌套查询列出项目文档
- `src/tools/delete-document.ts` — Create — `documentDelete` mutation，硬删除指定文档
- `src/tools/update-document.ts` — Create — `documentUpdate` mutation，更新文档标题/内容
- `src/server.ts` — Modify — 新增 3 个 import + 3 个工具定义 + 3 个 handler case
- `test/unit/list-documents.test.ts` — Create — 覆盖 list-documents.ts 的主要行为
- `test/unit/delete-document.test.ts` — Create — 覆盖 delete-document.ts 的主要行为
- `test/unit/update-document.test.ts` — Create — 覆盖 update-document.ts 的主要行为

---

## Task 1: 创建 list-documents.ts

**Difficulty**: easy
**Depends**: []
**Files**: Create `src/tools/list-documents.ts`

### Steps
- [ ] 创建 `src/tools/list-documents.ts`，导出 `listDocuments(args, graphql)` 函数和 `ListDocumentsArgs` 接口
- [ ] 实现 `ListDocumentsArgs`：`{ projectId: string; limit?: number }`，limit 默认值 25
- [ ] 实现 GraphQL 查询：`query ListDocuments($projectId: String!, $limit: Int!) { project(id: $projectId) { documents(first: $limit) { nodes { id title url updatedAt } } } }`
- [ ] 返回类型：`Array<{ id: string; title: string; url: string; updatedAt: string }>`
- [ ] 添加 project 为 null 时的错误处理：`throw new Error("Project not found: <projectId>")`

### Implementation Guardrails
**Allow variations**: updatedAt 字段可选（若 API 不返回可省略）
**Anti-patterns**: 不可用根级 `documents` 查询；不可省略 `first: $limit` 参数

### Verification
- `npx tsc --noEmit` 通过

---

## Task 2: 创建 delete-document.ts

**Difficulty**: easy
**Depends**: []
**Files**: Create `src/tools/delete-document.ts`

### Steps
- [ ] 创建 `src/tools/delete-document.ts`，导出 `deleteDocument(args, graphql)` 函数和 `DeleteDocumentArgs` 接口
- [ ] 实现 `DeleteDocumentArgs`：`{ id: string }`
- [ ] 实现 GraphQL mutation：`mutation DeleteDocument($id: String!) { documentDelete(id: $id) { success } }`
- [ ] 返回类型：`{ success: boolean }`
- [ ] 添加 `success: false` 时的错误处理：`throw new Error("documentDelete failed for document: <id>")`

### Implementation Guardrails
**Allow variations**: 无
**Anti-patterns**: 不可使用 `issueArchive` 风格的 input wrapper；mutation 名称必须是 `documentDelete`

### Verification
- `npx tsc --noEmit` 通过

---

## Task 3: 创建 update-document.ts

**Difficulty**: easy
**Depends**: []
**Files**: Create `src/tools/update-document.ts`

### Steps
- [ ] 创建 `src/tools/update-document.ts`，导出 `updateDocument(args, graphql)` 函数和 `UpdateDocumentArgs` 接口
- [ ] 实现 `UpdateDocumentArgs`：`{ id: string; title?: string; content?: string }`
- [ ] 动态构建 input 对象：只在参数非 `undefined` 时加入对应字段
- [ ] content 字段做 `\\n → \n` 正规化（与 create-document.ts 一致）：`content.replace(/\\n/g, "\n")`
- [ ] 实现 GraphQL mutation：`mutation UpdateDocument($id: String!, $input: DocumentUpdateInput!) { documentUpdate(id: $id, input: $input) { success document { id title url } } }`
- [ ] 返回类型：`{ id: string; title: string; url: string }`
- [ ] 添加 `success: false` 时的错误处理：`throw new Error("documentUpdate failed for document: <id>")`
- [ ] 添加 document 为 null 时的错误处理：`throw new Error("documentUpdate succeeded but returned no document data")`

### Implementation Guardrails
**Allow variations**: 无
**Anti-patterns**: 不可把 id 放入 input 对象；content 正规化不可省略

### Verification
- `npx tsc --noEmit` 通过

---

## Task 4: 创建单元测试

**Difficulty**: easy
**Depends**: [1, 2, 3]
**Files**: Create `test/unit/list-documents.test.ts`, `test/unit/delete-document.test.ts`, `test/unit/update-document.test.ts`

### Steps

**list-documents.test.ts：**
- [ ] 创建 `test/unit/list-documents.test.ts`，从 `../../src/tools/list-documents.js` 导入 `listDocuments`，从 `../setup.js` 导入 `createMockGraphQL`、`lastCall`
- [ ] 测试正常查询：mock 返回 `{ project: { documents: { nodes: [{ id: "doc-1", title: "T", url: "https://..." }] } } }`，验证 `lastCall` 的 query 含 "ListDocuments"，variables 含 `{ projectId: "proj-uuid", limit: 25 }`，返回值为文档数组
- [ ] 测试自定义 limit：传入 `limit: 10`，验证 variables.limit === 10
- [ ] 测试 project 不存在时抛出错误：mock 返回 `{ project: null }`，验证 rejects.toThrow("Project not found")

**delete-document.test.ts：**
- [ ] 创建 `test/unit/delete-document.test.ts`，导入 `deleteDocument`
- [ ] 测试成功删除：mock 返回 `{ documentDelete: { success: true } }`，验证 query 含 "DeleteDocument"，variables 含 `{ id: "doc-1" }`，返回 `{ success: true }`
- [ ] 测试删除失败时抛出错误：mock 返回 `{ documentDelete: { success: false } }`，验证 rejects.toThrow("documentDelete failed")

**update-document.test.ts：**
- [ ] 创建 `test/unit/update-document.test.ts`，导入 `updateDocument`
- [ ] 测试更新标题：mock 返回 `{ documentUpdate: { success: true, document: { id: "doc-1", title: "New", url: "https://..." } } }`，验证 variables.id === "doc-1"，variables.input.title === "New Title"
- [ ] 测试 content 正规化：传入 `content: "Line1\\nLine2"`，验证 variables.input.content === "Line1\nLine2"
- [ ] 测试只更新 title（content 未传）：验证 variables.input 不含 content 字段
- [ ] 测试 success: false 时抛出错误
- [ ] 测试 document 为 null 时抛出错误

### Implementation Guardrails
**Allow variations**: 测试描述文字可以意译，测试结构对齐 create-document.test.ts 风格
**Anti-patterns**: 不可用 `.toMatchSnapshot()`；每个测试必须包含 query 或 variables 的断言

### Verification
- `npm test -- test/unit/list-documents.test.ts test/unit/delete-document.test.ts test/unit/update-document.test.ts` 全部通过

---

## Task 5: 在 server.ts 注册三个工具

**Difficulty**: easy
**Depends**: [1, 2, 3]
**Files**: Modify `src/server.ts`

### Steps
- [ ] 在 `src/server.ts` 顶部 import 区域（紧跟 `import { updateProject }` 之后）新增三行 import：
  ```typescript
  import { listDocuments } from "./tools/list-documents.js";
  import { deleteDocument } from "./tools/delete-document.js";
  import { updateDocument } from "./tools/update-document.js";
  ```
- [ ] 在 `ListToolsRequestSchema` handler 的 tools 数组中（紧跟 `create_document` 工具定义之后）新增 `list_documents` 工具定义：
  ```typescript
  {
    name: "list_documents",
    description: "List documents in a Linear project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project UUID" },
        limit: { type: "number", description: "Max results (default 25)" },
      },
      required: ["projectId"],
    },
  },
  ```
- [ ] 紧跟其后新增 `delete_document` 工具定义：
  ```typescript
  {
    name: "delete_document",
    description: "Delete a document",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Document UUID" },
      },
      required: ["id"],
    },
  },
  ```
- [ ] 紧跟其后新增 `update_document` 工具定义：
  ```typescript
  {
    name: "update_document",
    description: "Update a document's title or content",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Document UUID" },
        title: { type: "string", description: "New title" },
        content: { type: "string", description: "New content (Markdown)" },
      },
      required: ["id"],
    },
  },
  ```
- [ ] 在 `CallToolRequestSchema` handler 的 switch 语句中（紧跟 `case "create_document":` 之后）新增三个 case：
  ```typescript
  case "list_documents": {
    const result = await listDocuments(
      args as { projectId: string; limit?: number },
      graphql
    );
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  case "delete_document": {
    const result = await deleteDocument(
      args as { id: string },
      graphql
    );
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  case "update_document": {
    const result = await updateDocument(
      args as { id: string; title?: string; content?: string },
      graphql
    );
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  ```

### Implementation Guardrails
**Allow variations**: 工具定义中 description 的措辞可微调
**Anti-patterns**: 不可改动现有工具的顺序；不可使用 `as any`

### Verification
- `npx tsc --noEmit` 通过
- `npm run build && npm test` 全部通过

### ✔ Commit Checkpoint 1
`feat(server): add list_documents, delete_document, update_document tools`
覆盖 Task 1-5

---

Self-review checklist: passed
