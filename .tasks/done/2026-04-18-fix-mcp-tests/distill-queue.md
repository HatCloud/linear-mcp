# Distill Queue

1. **Linear GraphQL Schema 变更规律**: ProjectFilter 中 `team` 被替换为 `accessibleTeams`（集合过滤器用 `some`/`every`），Number Comparator 统一用 `Float`，ID 过滤器用 `ID` 类型而非 `String`
2. **npm prepare 脚本作用域**: `prepare` 脚本会在消费者 `npm install` 时运行，需加 `test -d .git` 守卫
3. **Vitest ESM 项目集成**: ESM 项目中 Vitest 零配置即可工作，import 需 `.js` 扩展名
