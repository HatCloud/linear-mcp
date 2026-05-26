## Original Prompt
扩展 MCP 服务器

## Structured Requirement
- **Goal**: 为 linear-mcp 服务器新增三个工具：list_documents（列出项目文档）、delete_document（删除文档）、update_document（更新文档标题/内容）
- **Scope**: src/server.ts（工具注册）、src/graphql.ts（GraphQL 查询）、src/types.ts（类型定义）
- **Symptoms**: 当前 MCP 服务器只有 create_document，无法列出、删除或更新文档，用户需手动在 Linear 网页端操作
- **Suspected Cause**: 功能未实现（新功能请求，非 bug）
- **Expected Result**:
  - list_documents(projectId, limit?) → 返回项目下文档列表（id、title、url）
  - delete_document(id) → 删除指定文档，返回操作结果
  - update_document(id, title?, content?) → 更新文档标题或内容

## Issues with Original Prompt
- 初始描述仅为"扩展 MCP 服务器"，范围不够具体
- 初始仅提及 list + delete，后补充了 update

## Suggestions
更好的 prompt 写法："为 linear-mcp 添加 list_documents、delete_document、update_document 三个工具，对齐 create_document 的风格，支持对 Linear 项目文档的 CRUD 操作"
