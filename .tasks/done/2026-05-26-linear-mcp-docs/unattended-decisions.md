# Unattended Decisions

## Phase 2 — Step 2 澄清问题（Self-Discussion）

### Q1: 删除文档的 mutation 名称
**A**: `documentDelete(id: String!)` → `{ success: Boolean! }`
**置信**: High — Linear 对文档使用硬删除，无 archive 语义

### Q2: 列出项目文档的查询方式
**A**: `project { documents(first: $limit) { nodes { id title url } } }` 嵌套查询
**置信**: High — Linear 无根级 documents 查询，文档是 project 的附属实体

### Q3: documentUpdate mutation 签名
**A**: `documentUpdate(id: String!, input: DocumentUpdateInput!)`
**置信**: High — 与 projectUpdate、issueUpdate 模式完全一致

### Q4: DocumentUpdateInput 字段
**A**: 实现暴露 `title?: String`, `content?: String`
**置信**: Medium（字段存在 High，完整枚举 Medium）

所有关键问题均 High/Medium 置信，无需暂停。
