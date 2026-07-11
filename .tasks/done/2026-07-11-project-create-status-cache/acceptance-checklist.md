# Acceptance Checklist

**Task**: 2026-07-11-project-create-status-cache
**Generated**: 2026-07-11 18:11

## Round 1

### 自动化测试（已预填，无需修改）

1. [MUST] 运行 `npm run build && npm test` 全部通过
   → PASS （build success；128 tests passed）
2. [MUST] `create_project` 单测：全字段 input + milestones 顺序（sortOrder 0/1）、返回含里程碑结果
   → PASS （test/unit/create-project.test.ts）
3. [MUST] `create_project` 单测：某 milestone 失败 → 该项标 failed、不整体抛错
   → PASS
4. [MUST] `create_project` 向后兼容：仅 teamId/name → input 仅 {teamIds,name}、无里程碑调用
   → PASS
5. [MUST] `update_project` 单测：动态 input 只含传入字段（未传字段不出现）
   → PASS
6. [MUST] `get_status_map` 单测：缓存命中时 graphql 未被调用
   → PASS
7. [MUST] `get_status_map` 单测：refresh 绕过 / expect-miss 回源 / miss 回源写缓存
   → PASS
8. [MUST] `get_status_map` 单测（进程重启等价）：新建 cache 实例读同 key 命中、不发网络
   → PASS
9. [MUST] `get_status_map` 单测：默认 diskStatusCache 参数路径（不传 cache）工作
   → PASS
10. [MUST] `update_issue` 单测：state 提交失败 → invalidate 被调用且错误 rethrow；无 state 失败不失效
    → PASS
11. [MUST] `status-cache` 单测：read/write/invalidate 往返、路径穿越防护、FS 异常降级不抛
    → PASS

Linear 同步：HAT-570 → In Review ✓

### 手动测试（请填写）

> 无人值守 self_test：人工项 → 预填 DEFERRED，留待 task-end 后人工验收。

1. [MUST] 成功发布新版本到 npm：`npm run release:minor`（1.3.0 → 1.4.0，`npm publish --access public` 成功、tag 推送）
   测试方法：End 阶段 squash 之后执行 `npm run release:minor`
   → PASS（npm registry @hatcloud/linear-mcp@1.4.0 已确认；tag v1.4.0 + main 已推 origin）
2. [SHOULD] 用真实 Linear 集成调一次 create_project（含 milestones）人工核对 overview 信息饱满
   测试方法：真实调 create_project 传完整字段 + 里程碑，在 Linear overview 目视核对
   → DEFERRED（待人工验收）

### 追加修改（可选）

-
