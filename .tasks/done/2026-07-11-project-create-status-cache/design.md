# Design — 完备 project 创建/编辑 + status 本地磁盘缓存

## Overview

新增两个能力：(1) 增强 `create_project` / `update_project`，使其支持 Linear project 的完整字段集（icon、color、description、content 正文、日期、lead/members、status、里程碑），一次调用即可创建「信息完备」的 project（以 catgotcha 项目为蓝本）；(2) 给 `get_status_map` 加本地磁盘缓存——正常命中缓存、仅在三类失效场景下回源，减少重复的 workflowStates 网络查询。

## Goals / Non-Goals

**Goals**
- `create_project` 接受完整字段 + `milestones` 数组，一次调用建项目并批量建里程碑。
- `update_project` 接受同样的 project 标量字段，供后续编辑。
- `get_status_map` 结果按 team 输入持久化到磁盘；三触发回源：目标 status 不在缓存（`expect` 未命中）/ 提交出错失效 / 显式 `refresh`。
- 保持向后兼容：现有调用方（仅传 `teamId/name` 或 `team`）行为不变。

**Non-Goals**
- 不做任何里程碑的**编辑/删除/差异同步**；`update_project` **只改 project 标量字段、不含任何里程碑操作**。新建里程碑仅在 `create_project` 时支持；改/删已有里程碑留待后续专用工具。
- 不引入 project status 名称→UUID 的映射工具（`status` 作为 `statusId` 原始 UUID 传入，与现有 `leadId`/`memberIds`/issue `state` 约定一致）。
- 缓存不做 TTL 过期（用户明确：正常一律用缓存，只有出错才回源）。

## Architecture

### Feature 1 — Project 工具增强

Linear 权威 input 字段（经 introspection 确认）：
- `ProjectCreateInput`: name, icon, color, statusId, description, content, teamIds(必填), leadId, memberIds[], startDate/targetDate(TimelessDate=YYYY-MM-DD), priority。
- `ProjectMilestoneCreateInput`: name, description, targetDate, projectId, sortOrder。
- `ProjectUpdateInput`: 与 create 同名标量字段全部支持。

**`icon` 语义**：Linear project 图标是**具名图标**（如蓝本的 `"FaceMonocle"`），也接受 emoji；schema 描述据实更新（不再仅写 "emoji"）。

**create_project 流程**：
1. 动态构建 `ProjectCreateInput`（只放调用方实际传入的字段，沿用 update-issue 的「undefined vs absent」纪律），`teamIds: [teamId]`。
2. `projectCreate` 成功后，若传了 `milestones`，**按数组顺序**逐个 `projectMilestoneCreate`（`projectId` = 新建 id，`sortOrder` = index）。
3. 返回结构化结果，含每个里程碑的创建状态。

**update_project 流程**：动态构建 `ProjectUpdateInput`（同 create 的标量字段集），`projectUpdate(id, input)`。不含里程碑（Non-Goal）。

### Feature 2 — status 磁盘缓存

新模块 `src/status-cache.ts`，与工具层解耦（不依赖任何 tool）：

```ts
export interface StatusCache {
  read(key: string): StatusMapResult | null;
  write(key: string, value: StatusMapResult): void;
  invalidate(): void; // 清空全部（当前无按 key 精确失效的调用方，YAGNI）
}
export function createDiskStatusCache(opts?: { dir?: string }): StatusCache;
export const diskStatusCache: StatusCache; // 默认单例，工具默认使用
```

- **缓存目录**：`${XDG_CACHE_HOME || ~/.cache}/linear-mcp/<apiKeyHash8>/status-map/`，其中 `apiKeyHash8` = `sha256(process.env.LINEAR_API_KEY).slice(0,8)`（缺 key 时用 `"default"`）——避免多 workspace（不同 API key）串键。
- **cacheKey** = `normalize(team) = team.trim().toLowerCase()`。理由：key 输入（"HAT"）走缓存命中时**不再触发 key→UUID 的 teams 网络查询**（该解析在 `get-status-map` 内、位于 fetch 之前）；命中直接返回。key 与 UUID 两种输入各自成文件（可接受的少量重复）。
- **文件名安全化（I2）**：cacheKey 来自调用方传入的 `team` 字符串，**不直接用作文件名**（可能含 `/`、`..` 等路径穿越字符）。文件名 = `sha256(cacheKey).slice(0,16) + ".json"`；可读 key 存入 JSON body 的 `team` 字段供调试。
- **文件格式**：`{ "cachedAt": "<iso>", "team": "<可读 cacheKey>", "result": { map, all } }`。`cachedAt` 仅供调试，不做过期判断。
- **原子写（I5）**：`write()` 采用 **write-temp-then-rename**（先写同目录临时文件再 `rename`），避免并发 miss 回源同时写同一文件导致的截断/交错、产生无法解析的 JSON。
- **健壮性**：所有 FS 读写包 try/catch——读失败（含 JSON 解析失败）视为 miss、写失败静默跳过，**缓存故障绝不破坏 get_status_map**（降级为直连网络）。

## Data Flow

**getStatusMap({ team, refresh?, expect? }, graphql, cache = diskStatusCache)**（`team` 并入首个 args 对象，与现有 `getStatusMap(args:{team}, graphql)` 同形——`refresh/expect` 为可选字段、`cache` 为可选参数，**现有 2-参数调用天然兼容、server.ts 零改动**）：
1. `key = normalize(team)`。
2. 非 `refresh` 时 `cached = cache.read(key)`：
   - 命中且（无 `expect` 或 `expect ∈ cached.result.map`）→ **返回缓存**（不发网络）。
   - 命中但 `expect` 给定且不在 map 中 → 视为 miss（**触发①**：目标 status 不在缓存 → 回源）。
3. miss / refresh / expect-miss → `resolveTeamId` + `fetchStatusMap`（原逻辑）→ `cache.write(key, result)` → 返回。（**触发③** = refresh）

**update_issue（触发②）**：给 `updateIssue` 增可选 `cache=diskStatusCache`。当 `args.state` 给定且 `issueUpdate` 抛错时 → `cache.invalidate()`（清空全部；issue→team 未知，全清代价低）→ 原样 rethrow。下次 `get_status_map` 自然 miss 回源，实现自愈。

**wiring**：`get_status_map` / `update_issue` 的 cache 参数默认取 `diskStatusCache` 单例；`server.ts` 调用处不需改动（默认参数）。测试注入临时目录 cache 或内存 mock。

## Error Handling

- `projectCreate` 失败 → 抛错（沿用现状）。
- 里程碑部分失败：project 已建成，**不整体抛错**；逐个捕获，返回结果里标 `status: "created" | "failed"` + `error`，让调用方可对失败项补建。
- 缓存 FS 异常 → 降级直连，不抛。
- `update_issue` state 提交失败 → 先失效缓存再 rethrow（错误对调用方仍可见）。**失效粒度（M7）**：触发条件是「`args.state` 存在 且 `issueUpdate` 调用失败」，**不区分失败原因**（assignee 非法等无关错误也会触发全量 `invalidate()`）——issue→team 未知，全清代价低，属有意权衡。
- **expect 恒不存在（I3）**：`expect` 回源后仍不在新 map 中 → 返回刷新后的 map（调用方据此判定该状态确不存在）。单次 `get_status_map` 调用**至多回源一次**（不会死循环）；但同一 `expect` 值跨多次调用会各付一次网络——属已知权衡（不引入 TTL / 长期负缓存），正常业务里 `expect` 应是真实存在的状态名。
- **invalidate 与 in-flight write 的时序竞态（I-R2-1，已知权衡）**：极端并发下，一个先于 `invalidate()` 发起、后于其返回的 `fetchStatusMap` 结果可能被 `write()` 落盘，等效撤销这次失效。**不引入 epoch/版本号**（对本地状态缓存过度）——依赖最终收敛：下次用陈旧 UUID 提交仍会失败并再次 `invalidate()`，自愈至多延后一个请求周期。在此明确记录为可接受权衡。

## Components / 接口契约

| 单元 | What（对外） | How（内部） | Depends on |
|---|---|---|---|
| `status-cache.ts` | `StatusCache` 读/写/失效；`diskStatusCache` 单例 | XDG 目录 + apiKey 命名空间 + 按 key 文件；FS 容错 | node fs/os/crypto、`StatusMapResult` 类型 |
| `get-status-map.ts` | `getStatusMap({team,refresh?,expect?}, graphql, cache?)` → `StatusMapResult`（形状不变） | 缓存命中短路；miss 回源写缓存 | status-cache、graphql |
| `update-issue.ts` | 签名增可选 `cache?`；行为不变 | state 失败时 `invalidate()` + rethrow | status-cache（软依赖） |
| `create-project.ts` | 全字段 + `milestones[]`；返回含里程碑结果 | 动态 input + 顺序建里程碑 | graphql |
| `update-project.ts` | 全 project 标量字段 | 动态 input | graphql |
| `server.ts` | 三个 tool 的 inputSchema 扩字段 | — | 各 tool |
| `types.ts` | 新增 `CreateProjectArgs`/`UpdateProjectArgs`/里程碑/缓存文件类型 | — | — |

## Success Criteria

- 传完整字段 + milestones 能创建出信息饱满的 project（对齐 catgotcha 完备程度）。
- 重复 `get_status_map` 命中磁盘缓存、进程重启后仍命中、不发网络。
- 三失效触发行为正确、可自愈。
- 现有调用零行为变更；`npm run build && npm test` 全绿。

## Acceptance Tests

- [MUST] 运行 `npm run build && npm test` 全部通过。
- [MUST] `create_project` 单测：传全字段 + 2 个 milestones → `projectCreate` input 含全部字段、`projectMilestoneCreate` 按序被调用 2 次（sortOrder 0/1），返回含里程碑结果。
- [MUST] `create_project` 单测：某个 milestone 失败 → project 结果仍返回、该 milestone 标 `failed`，不整体抛错。
- [MUST] `create_project` 单测（向后兼容，I4）：仅传 `teamId/name(/icon)` → `projectCreate` input 与增强前等价（无多余字段、`teamIds:[teamId]`），无里程碑调用。
- [MUST] `update_project` 单测：动态 input 只含传入字段（未传字段不出现在 input，避免误清空）。
- [MUST] `get_status_map` 单测：缓存命中时 `graphql` **未被调用**（mock 调用即失败）；不传 `refresh/expect` 时行为等价于旧签名。
- [MUST] `get_status_map` 单测（进程重启等价，M8）：写缓存后**新建 cache 实例**（模拟进程重启）读同 key → 命中、不发网络。
- [MUST] `get_status_map` 单测：`refresh:true` 绕过缓存回源；`expect` 未命中缓存 → 回源；miss → 回源并写缓存。
- [MUST] `update_issue` 单测：`state` 提交失败 → `cache.invalidate` 被调用且错误被 rethrow。
- [MUST] `status-cache` 单测：read/write/invalidate 往返（用临时目录）；FS 异常降级不抛。
- [MUST] **成功发布新版本到 npm**：`npm run release:minor`（1.3.0 → 1.4.0，`npm publish --access public` 成功、tag 推送）。
  - 前提（M-R2-2）：执行环境已配置 npm 发布凭证（`~/.npmrc` 或等效），且账号未对 publish 强制 OTP/2FA；如遇 OTP 阻塞需人工介入（无人值守下此步会硬停 + Telegram 通知，非本设计可自动化范畴）。
  - 半失败态处理（I-R2-2）：`release:minor` = `npm test && npm version minor && npm publish && git push && git push --tags`。若 `npm publish` 在 `npm version` 之后失败 → 本地已多出未推送的 version bump commit + tag，需**人工检查并按需 revert**（`git reset`/`git tag -d`），**不自动重试、不 unpublish**；发布后发现问题只能 fix-forward 发新 patch 版本。
  - 变体：可用 `npm version minor` + `npm publish` 手动分步等价执行。
  - 反模式：跳过 `npm test`、或以 dry-run 冒充真实发布。
- [SHOULD] 用真实 Linear 集成调一次 `create_project`（含 milestones）人工核对 overview 信息饱满（归 Phase 5 人工验收，可 DEFERRED）。

## Out of Scope

- 里程碑的编辑/删除/差异同步。
- project status 名称→UUID 映射工具。
- 缓存 TTL / 定时刷新。
- issue `state` 名称直传（仍由调用方经 get_status_map 拿 UUID）。

## Execution Strategy

- 执行模式：`inline`（Medium 复杂度、文件相互关联、单批 <3 独立 task，不 fan-out）。
- 引擎：主 agent 当前模型（codex FALLBACK，配额=0）。
- TDD：lite（关键单元先写测试断言，红→绿）。

## Review Strategy

- Design review：**2 轮已完成**（R1 结构审查 + R2 对抗审查，因 Medium 下 R1 命中 Critical≥1/Important≥3 触发 R2）；reviewer=claude native（codex FALLBACK credit=0 降级，已记 fallback-log.jsonl）。R1(C1/I4/M3)+R2(C1/I2/M2) 全部 Accept 并就地修复，收敛 C=0/I=0。
- Code review：medium，per-task=checkpoint（P4.post-execute 全量兜底；本任务无高敏感面——非认证/资金/迁移，沿用 checkpoint）。
- Plan review：1 轮（Medium）。
- Reviewer type: Claude

## 复杂度评估

Medium：涉及文件 ~7、模块 2、外部 API 1、新增本地模块（status-cache）、design.md ~1000 字。与 Standard preset 一致，无 Step 2e 偏离。
