# 完备 project 创建/编辑 + status 本地磁盘缓存 Implementation Plan

**Design**: design.md
**Complexity**: Medium
**Tasks**: 6

## Verification Commands
- Light: `npx tsc --noEmit`
- Full: `npm run build && npm test`

## File Structure
- `src/status-cache.ts` — Create — `StatusCache` 接口 + `createDiskStatusCache()` + `diskStatusCache` 单例；磁盘持久化（XDG + apiKey 命名空间）、文件名哈希、原子写、FS 容错。
- `test/unit/status-cache.test.ts` — Create — read/write/invalidate 往返、进程重启等价、FS 异常降级不抛。
- `src/tools/get-status-map.ts` — Modify — 加缓存：args `{team, refresh?, expect?}` + 可选 `cache` 参数；命中短路 / miss 回源写缓存 / expect-miss / refresh。
- `test/unit/get-status-map.test.ts` — Modify — 命中不发网络、refresh 绕过、expect-miss 回源、miss 写缓存、向后兼容、重启等价。
- `src/tools/update-issue.ts` — Modify — 加可选 `cache` 参数；`state` 提交失败时 `invalidate()` + rethrow。
- `test/unit/update-issue.test.ts` — Modify — state 提交失败触发 invalidate 且错误 rethrow；无 state 失败不失效。
- `src/tools/create-project.ts` — Modify — 扩 `CreateProjectArgs` 全字段 + `milestones[]`；动态 input + 顺序建里程碑（`CreateMilestone` mutation）；结构化返回含里程碑状态。
- `test/unit/create-project.test.ts` — Modify — 全字段 input、milestones 顺序（sortOrder 0/1）、部分失败结构化返回、向后兼容。
- `src/tools/update-project.ts` — Modify — 扩 `UpdateProjectArgs` 全 project 标量字段；动态 input（只含传入字段）。
- `test/unit/update-project.test.ts` — Modify — 动态 input 只含传入字段；未传字段不出现。
- `src/server.ts` — Modify — `create_project`/`update_project`/`get_status_map` 的 inputSchema 扩字段 + CallTool handler 透传新 args（`update_issue` schema 不变，cache 为内部默认参数）。
- `src/graphql.ts` — 契约另一端（需核实，不改）：`GraphQLFn` 类型；status-cache 与 update-issue 依赖其错误抛出语义（GraphQL error → throw）。

## Task 1: [P] status-cache 磁盘缓存模块

**Difficulty**: medium
**Depends**: []
**Files**: Create `src/status-cache.ts`, Create `test/unit/status-cache.test.ts`

### Steps
- [x] RED: 写测试 `test/unit/status-cache.test.ts` — 用 `createDiskStatusCache({ dir })` 指向 `os.tmpdir()` 下临时目录：(a) `write("hat", result)` 后 `read("hat")` 深等于 result；(b) `write` 后**新建** cache 实例 `read("hat")` 仍命中（模拟进程重启）；(c) `invalidate()` 后 `read("hat")` 返回 null；(d) `read("不存在")` 返回 null；(e) 损坏 JSON 文件 → `read` 返回 null 不抛；(f) 只读目录 `write` 不抛（静默）。result 用 `{ map: { "In Progress": "u1" }, all: [{ id: "u1", name: "In Progress", type: "started" }] }`。
- [x] RED-VERIFY: `npx vitest run test/unit/status-cache.test.ts` → 期望 FAIL（模块不存在 / 未实现）
- [x] GREEN: 实现 `src/status-cache.ts`：`export interface StatusCache { read(key): StatusMapResult|null; write(key, value): void; invalidate(): void }`；`createDiskStatusCache(opts?: { dir?: string })`：cacheDir = `opts.dir ?? path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "linear-mcp", apiKeyHash8(), "status-map")`，`apiKeyHash8 = crypto.createHash("sha256").update(process.env.LINEAR_API_KEY||"default").digest("hex").slice(0,8)`；文件名 = `sha256(normalize(key)).slice(0,16)+".json"`，`normalize = s => s.trim().toLowerCase()`；`write` 用 write-temp-then-rename（临时名 `<final>.<pid>.tmp` 同目录 `fs.writeFileSync` 再 `fs.renameSync`，先 `fs.mkdirSync(dir,{recursive:true})`），body `{ cachedAt: new Date().toISOString(), team: normalize(key), result }`；`read` try/catch 读 + `JSON.parse`，返回 `.result` 或 null；`invalidate` try/catch `fs.rmSync(cacheDir,{recursive:true,force:true})`；所有 FS 操作包 try/catch，异常降级（read→null，write/invalidate→静默）。导出 `export const diskStatusCache = createDiskStatusCache();`
- [x] GREEN-VERIFY: `npx vitest run test/unit/status-cache.test.ts` → 期望 PASS
- [x] REFACTOR: 抽 `keyToFilename(key)` 私有函数供 read/write/（未来失效）共用同一映射 → `npx vitest run test/unit/status-cache.test.ts` 仍 PASS

### Implementation Guardrails
**Allow variations**: 临时文件命名、hash 截断长度（≥12 即可）可调；同步 FS（`*Sync`）优于异步（工具调用是 await 链，避免引入竞态）。
**Anti-patterns**: 不引入第三方缓存库；不加 TTL / 过期判断；不让任何 FS 异常冒泡到调用方；文件名不得直接用原始 key（路径穿越）。

### Verification
- `npx tsc --noEmit` 通过；`npx vitest run test/unit/status-cache.test.ts` 全绿。

## Task 2: get-status-map 缓存改造

**Difficulty**: medium
**Depends**: [1]
**Files**: Modify `src/tools/get-status-map.ts`, Modify `test/unit/get-status-map.test.ts`

### Steps
- [x] RED: 在 `test/unit/get-status-map.test.ts` 增测试（用内存 mock cache：`{ store: new Map(), read(k){return this.store.get(k)??null}, write(k,v){this.store.set(k,v)}, invalidate(){this.store.clear()} }`）：(a) cache 已有 "hat" → `getStatusMap({team:"hat"}, mockGraphql, cache)` 返回缓存值且 `mockGraphql.calls.length===0`（命中不发网络）；(b) `refresh:true` → 即使命中也调 graphql 回源并 `write`；(c) `expect:"New"` 且缓存 map 无 "New" → 回源；(d) cache 空（miss）→ 调 graphql 且回源结果被 `write` 进 cache；(e) 向后兼容：`getStatusMap({team:"HAT"}, mockGraphql)`（不传 cache）走默认 diskStatusCache 不报错。
- [x] RED（M8 进程重启等价，集成层）：用 `createDiskStatusCache({ dir: tmpDir })` 先 `getStatusMap({team:"HAT"}, mockGraphqlA, cacheA)` 触发一次 miss+回源+写盘（`mockGraphqlA.calls.length===1`）；再用**同一 tmpDir 新建第二个** `createDiskStatusCache({ dir: tmpDir })` 作为 cache 调 `getStatusMap({team:"HAT"}, mockGraphqlB, cacheB)` → 断言命中、`mockGraphqlB.calls.length===0`（模拟进程重启后读盘命中不发网络）。
- [x] RED-VERIFY: `npx vitest run test/unit/get-status-map.test.ts` → 期望 FAIL
- [x] GREEN: 改 `getStatusMap(args: { team: string; refresh?: boolean; expect?: string }, graphql: GraphQLFn, cache: StatusCache = diskStatusCache)`：`const key = args.team`（cache 内部 normalize）；若 `!args.refresh`：`const cached = cache.read(key)`，命中且（`!args.expect || args.expect in cached.map`）→ `return cached`；否则（miss/refresh/expect-miss）走原 `resolveTeamId` + `fetchStatusMap`，成功后 `cache.write(key, result)` 再 `return result`。import `StatusCache, diskStatusCache`。保持 `resolveTeamId`/`fetchStatusMap` 原逻辑不动。
- [x] GREEN-VERIFY: `npx vitest run test/unit/get-status-map.test.ts` → 期望 PASS
- [x] REFACTOR: 确认 `expect in cached.map` 用 `Object.prototype.hasOwnProperty` 安全判定 → 重跑仍 PASS

### Implementation Guardrails
**Allow variations**: cache 命中判定顺序可微调，只要满足三触发语义。
**Anti-patterns**: 不改 `StatusMapResult` 返回形状（向后兼容）；不在命中路径调用 `resolveTeamId`（那会发网络、抵消缓存收益）；缓存写失败不得影响返回。

### Verification
- `npx tsc --noEmit` 通过；`npx vitest run test/unit/get-status-map.test.ts` 全绿。

## Task 3: update-issue 提交失败失效联动

**Difficulty**: easy
**Depends**: [1]
**Files**: Modify `src/tools/update-issue.ts`, Modify `test/unit/update-issue.test.ts`

### Steps
- [x] RED: 在 `test/unit/update-issue.test.ts` 增测试：(a) mock graphql 在 `issueUpdate` 抛错 + `args.state` 传入 → 传入 spy cache（`invalidate` 记调用次数）→ `updateIssue` 抛错（rethrow）且 `cache.invalidate` 被调用 1 次；(b) 无 `state` 时 graphql 抛错 → `cache.invalidate` **不**被调用；(c) 成功路径不调用 invalidate。
- [x] RED-VERIFY: `npx vitest run test/unit/update-issue.test.ts` → 期望 FAIL
- [x] GREEN: `updateIssue(args, graphql, cache: StatusCache = diskStatusCache)`；把 `graphql(...)` mutation 调用包 try/catch：catch 内若 `args.state !== undefined` → `cache.invalidate()`，然后 `throw`（原样 rethrow）。import `StatusCache, diskStatusCache`。其余逻辑不动。
- [x] GREEN-VERIFY: `npx vitest run test/unit/update-issue.test.ts` → 期望 PASS
- [x] REFACTOR: 确认非 state 失败路径不误触发 → 重跑仍 PASS

### Implementation Guardrails
**Allow variations**: 可只包裹 mutation await，或包裹到 success 检查（`success===false` 抛错也属提交失败，应一并失效——优先覆盖这条）。
**Anti-patterns**: 不区分具体错误类型（M7：state 存在+失败即失效）；不吞掉原始错误（必须 rethrow）。

### Verification
- `npx tsc --noEmit` 通过；`npx vitest run test/unit/update-issue.test.ts` 全绿。

### ✔ Commit Checkpoint 1
`feat(status-cache): get_status_map 本地磁盘缓存 + 三失效触发`
覆盖 Task 1-3

## Task 4: [P] create-project 全字段 + 里程碑批量创建

**Difficulty**: medium
**Depends**: []
**Files**: Modify `src/tools/create-project.ts`, Modify `test/unit/create-project.test.ts`

### Steps
- [x] RED: 在 `test/unit/create-project.test.ts` 增测试：(a) 传全字段（icon,color,description,content,statusId,leadId,memberIds:["m1"],startDate,targetDate,priority）+ `milestones:[{name:"M1"},{name:"M2",targetDate:"2026-08-01"}]` → 首个调用 query 含 `CreateProject` 且 input 含全部字段、`teamIds:["team-uuid"]`；随后 2 次 `CreateMilestone` 调用，input.projectId=新建 id、`sortOrder` 0 与 1、name 对应；返回含 `milestones:[{name,id,status:"created"}...]`；(b) 部分失败：自定义 mock fn 在第 2 个 milestone 抛错 → project 结果仍返回、milestone[0].status==="created"、milestone[1].status==="failed" 且含 error，**不整体抛错**；(c) 向后兼容：仅传 `teamId/name` → input 仅 `{ teamIds, name }`（无 undefined 字段泄漏）、无 `CreateMilestone` 调用。
- [x] RED-VERIFY: `npx vitest run test/unit/create-project.test.ts` → 期望 FAIL
- [x] GREEN: 扩 `CreateProjectArgs`：加 `color?,description?,content?,statusId?,leadId?,memberIds?:string[],startDate?,targetDate?,priority?:number,milestones?:Array<{name:string;description?:string;targetDate?:string}>`。动态构建 input（只放 `!== undefined` 的字段，`teamIds:[args.teamId]`）。`projectCreate` 成功后若 `args.milestones?.length`：`for (const [i, m] of milestones.entries())` 顺序 `await graphql(CreateMilestone mutation, { input: { projectId, name, description?, targetDate?, sortOrder: i } })`，每个包 try/catch，push `{name, id?, status, error?}`。返回 `{ id, name, url, milestones? }`。CreateMilestone mutation：`mutation CreateMilestone($input: ProjectMilestoneCreateInput!){ projectMilestoneCreate(input:$input){ success projectMilestone{ id name } } }`。
- [x] GREEN-VERIFY: `npx vitest run test/unit/create-project.test.ts` → 期望 PASS
- [x] REFACTOR: 抽动态 input 构建为局部 helper（与 update-project 风格一致）→ 重跑仍 PASS

### Implementation Guardrails
**Allow variations**: milestone 返回结构字段名可微调，只要含 name+status。
**Anti-patterns**: 里程碑失败不得整体抛错（project 已建成）；不把 undefined 字段塞进 input；milestone mutation 名不得含 "CreateProject" 子串（避免 mock 关键词冲突）。

### Verification
- `npx tsc --noEmit` 通过；`npx vitest run test/unit/create-project.test.ts` 全绿。

## Task 5: [P] update-project 全 project 标量字段

**Difficulty**: easy
**Depends**: []
**Files**: Modify `src/tools/update-project.ts`, Modify `test/unit/update-project.test.ts`

### Steps
- [x] RED: 在 `test/unit/update-project.test.ts` 增测试：(a) 传 `{id, icon, color, description, content, statusId, leadId, memberIds, startDate, targetDate, priority}` → input 含全部对应字段（`statusId` 原样、`memberIds` 数组）；(b) 只传 `{id, description}` → input 仅 `{description}`（未传字段不出现，避免误清空）；(c) 现有：只传 `{id, name}` 仍工作。
- [x] RED-VERIFY: `npx vitest run test/unit/update-project.test.ts` → 期望 FAIL
- [x] GREEN: 扩 `UpdateProjectArgs` 加 `icon?,color?,description?,content?,statusId?,leadId?,memberIds?:string[],startDate?,targetDate?,priority?:number`。动态 input 逐字段 `if (args.x !== undefined) input.x = args.x`。mutation/返回不变。
- [x] GREEN-VERIFY: `npx vitest run test/unit/update-project.test.ts` → 期望 PASS
- [x] REFACTOR: 字段赋值排列与 create 对齐 → 重跑仍 PASS

### Implementation Guardrails
**Allow variations**: 字段顺序自由。
**Anti-patterns**: 不含里程碑操作（Non-Goal）；不把未传字段写进 input。

### Verification
- `npx tsc --noEmit` 通过；`npx vitest run test/unit/update-project.test.ts` 全绿。

### ✔ Commit Checkpoint 2
`feat(project): create/update_project 支持完备字段与里程碑`
覆盖 Task 4-5

## Task 6: server.ts tool schema 注册与透传

**Difficulty**: easy
**Depends**: [2, 4, 5]
**Files**: Modify `src/server.ts`

### Steps
- [x] RED: 验收命令 `npm run build` 后，`node -e "..."` 或直接看 ListTools schema——先跑 `npm run build`，确认当前 `create_project` schema 无 `milestones`/`description`/`content` 字段（RED 现状）。
- [x] RED-VERIFY: `npm run build` 成功但 schema 缺新字段（现状确认）
- [x] GREEN: 更新 `create_project` inputSchema：加 `color,description,content,statusId,leadId,memberIds(array of string),startDate,targetDate,priority(number),milestones(array of object{name(required),description,targetDate})`；`icon` 描述改为 "Linear 图标名（如 FaceMonocle）或 emoji"。更新 `update_project` inputSchema：加 `icon,color,description,content,statusId,leadId,memberIds,startDate,targetDate,priority`。更新 `get_status_map` inputSchema：加 `refresh(boolean),expect(string)`。CallTool handler 中三个 case 的 `args as {...}` 类型断言补齐新字段透传（`update_issue` case 不改——cache 走默认参数）。
- [x] GREEN-VERIFY: `npm run build && npm test` → 期望全 PASS
- [x] REFACTOR: 核对三个 tool 的 description 文案准确（create_project description 改为 "Create a fully-populated project (icon, description, content, milestones, ...)"）→ `npm run build` 仍成功

### Implementation Guardrails
**Allow variations**: schema 字段描述文案自由。
**Anti-patterns**: 不改 `update_issue` schema（cache 是内部机制）；不遗漏 handler 层的 args 透传（否则 schema 有字段但实现收不到）。

### Verification
- `npm run build && npm test` 全绿（full verification）。

### ✔ Commit Checkpoint 3
`feat(server): 注册完备 project 与 status 缓存的 tool schema`
覆盖 Task 6

Self-review checklist: passed
