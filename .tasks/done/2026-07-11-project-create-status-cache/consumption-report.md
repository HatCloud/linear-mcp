# Consumption Report

**Session**: 2b72f9eb-0327-4bc6-a4f9-3516fc6947b6

## 总量

- Input tokens: 770 (uncached)
- Cache read: 92.6M
- Cache create: 1.1M
- Output tokens: 426.8K
- Assistant turns: 390
- User turns: 173
- Tool calls: 170

## 阶段消耗

| Phase | Output Tokens | Input (uncached) | Cache Read | Tool Calls | Output % |
|-------|---------------|-----------------|------------|------------|----------|
| P0:Pre-Init | 426.8K | 770 | 92.6M | 170 | 100% |

## 工具调用统计

| Tool | Count | Avg Output Tokens |
|------|-------|------------------|
| Bash | 65 | 767 |
| Edit | 42 | 946 |
| Read | 26 | 534 |
| Write | 13 | 2565 |
| AskUserQuestion | 7 | 1709 |
| Agent | 5 | 1767 |
| ToolSearch | 3 | 395 |
| mcp__linear__update_issue | 3 | 679 |
| mcp__linear__create_comment | 3 | 550 |
| TaskCreate | 1 | 250 |
| mcp__linear__get_status_map | 1 | 645 |
| mcp__linear__create_issue | 1 | 645 |

## 高消耗行为分析

- **最大输出阶段**: P0:Pre-Init — 426.8K output tokens (100%)
- **最多调用工具**: Bash — 65 次
- **高 token 工具** (avg > 500 output/call):
  - Write: 13 calls, avg 2565 tokens
  - Agent: 5 calls, avg 1767 tokens
  - AskUserQuestion: 7 calls, avg 1709 tokens
  - Edit: 42 calls, avg 946 tokens
  - Bash: 65 calls, avg 767 tokens
- **Cache 命中率**: 99%
