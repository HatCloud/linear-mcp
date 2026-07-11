# Technical Debt

> `- [ ]` = open，`- [x] ... — resolved: <出处>` = 已解决。

- [ ] `test/integration/api.test.ts` 有 3 处预存 tsc 类型错误（`updateIssue` 返回无 `.success`、`searchIssues` 用 `teamId` 应为 `team`、`updateIssue` 返回类型），与 `2026-07-11-project-create-status-cache` 无关但令 `npx tsc --noEmit` 报错；`npm test` 只跑 `test/unit/` 故不影响 CI。待订正 integration 测试以对齐当前工具签名。— 记录: HAT-570
- [ ] `create_project`/`update_project` 的 `memberIds: []`（显式空数组，语义=清空成员）无测试锁定该行为，仅有非空数组覆盖。— 记录: HAT-570
- [ ] design.md 组件表称新增类型入 `types.ts`，实际 `CreateProjectArgs`/`UpdateProjectArgs`/里程碑/缓存类型沿项目惯例定义在各自模块内（与 plan 一致）。design 描述与实现的小落差，供后续订正 design 描述。— 记录: HAT-570
