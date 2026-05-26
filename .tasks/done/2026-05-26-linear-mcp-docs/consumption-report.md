# Consumption Report

**Session**: 759e6ad5-9141-4ea0-a362-af007e4b0a3a

## 总量

- Input tokens: 20.5K (uncached)
- Cache read: 170.0M
- Cache create: 2.0M
- Output tokens: 798.2K
- Assistant turns: 609
- User turns: 317
- Tool calls: 298

## 阶段消耗

| Phase | Duration | Output Tokens | Input (uncached) | Cache Read | Tool Calls | Output % |
|-------|----------|---------------|-----------------|------------|------------|----------|
| P0:Pre-Init | 1m | 9.7K | 21 | 357.1K | 3 | 1% |
| P1:Init | 35m | 101.9K | 202 | 9.6M | 49 | 13% |
| P2:Design | 1.5h | 312.8K | 19.7K | 46.7M | 90 | 39% |
| P3:Plan | 10m | 103.4K | 128 | 21.5M | 36 | 13% |
| P4:Execute | 16m | 270.5K | 448 | 91.8M | 120 | 34% |

## 工具调用统计

| Tool | Count | Avg Output Tokens |
|------|-------|------------------|
| Edit | 84 | 1287 |
| TaskUpdate | 72 | 1081 |
| Bash | 46 | 678 |
| Read | 36 | 752 |
| TaskCreate | 31 | 2086 |
| AskUserQuestion | 9 | 3208 |
| Agent | 8 | 2631 |
| Write | 6 | 4315 |
| ToolSearch | 3 | 527 |
| mcp__linear__get_issue | 1 | 192 |
| mcp__linear__update_issue | 1 | 149 |
| mcp__linear__create_comment | 1 | 802 |

## 高消耗行为分析

- **最大输出阶段**: P2:Design — 312.8K output tokens (39%)
- **最多调用工具**: Edit — 84 次
- **高 token 工具** (avg > 500 output/call):
  - Write: 6 calls, avg 4315 tokens
  - AskUserQuestion: 9 calls, avg 3208 tokens
  - Agent: 8 calls, avg 2631 tokens
  - TaskCreate: 31 calls, avg 2086 tokens
  - Edit: 84 calls, avg 1287 tokens
- **Cache 命中率**: 99%

## Plugin Breakdown

| Plugin | Invocations | Errors | Skipped |
|--------|-------------|--------|---------|
| observability | 11 | 0 | 0 |
| linear | 4 | 0 | 0 |
| review | 1 | 0 | 0 |
| git | 1 | 0 | 0 |

Total timing entries: 12
Phase durations: P1=1m, P2=5m, P3=3m, P4=20m, P5=2m, P6=ongoing (pre-archive snapshot)
