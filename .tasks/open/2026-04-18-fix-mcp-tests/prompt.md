## Original Prompt
阅读瑶瑶的测试报告，尝试修复。并为本项目引入单元测试框架并添加每个接口的测试用例。需要在 git 的 hook 的合适地点添加测试用例通过检查。

之前有实现过一个测试，看看它的实现，并将其吸收进新的测试框架中。删除旧实现。

## Structured Requirement
- **Goal**: 修复 Linear MCP 中 5 个有问题的接口，建立完整测试框架（Mock + 集成测试），配置 git hook
- **Scope**: 
  - 修复 list_projects（GraphQL schema 不匹配）
  - 修复 list_comments（变量类型 String! → ID）
  - 修复 list_issues priority 过滤（Int! → Float）
  - 排查 list_attachments 返回空数组
  - 排查 update_issue 回读不一致
  - 引入测试框架，Mock 测试 + 集成测试
  - pre-commit hook 跑 Mock 测试，pre-push hook 跑完整测试
  - 吸收旧测试实现，删除旧代码
- **Symptoms**: 详见瑶瑶测试报告
- **Expected Result**: 所有接口通过测试，git hook 自动阻止测试不通过的提交

## Issues with Original Prompt
- 测试报告非常详细清晰，问题定位准确
- 需要独立验证报告中的每个问题，不能仅依赖报告

## Suggestions
- 可以附上 Linear GraphQL schema 文档链接以便对照
