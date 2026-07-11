## Original Prompt

我希望新增两个动作：

1. 便捷地创建一个信息完备的 project：
   (a) 包括小 icon、名字、描述、里程碑等，这些都要能作为参数来编辑。
   (b) 你可以看一下，我手头有一个信息比较完备的 project，可以以这个的编辑程度为蓝本。

2. status 可以在本地有缓存：
   (a) 正常情况下直接使用本地缓存。
   (b) 只有在出错了（比如提交时出错、发现 status 不存在或报错）的情况下，才会去拉取最新的。

信息最完备的项目：https://linear.app/hatcloud/project/%E5%96%B5%E9%81%87-catgotcha-480fe1f6c466/overview

补充（会话中）：最后验收中需要加上「成功发布」（npm publish 新版本）。

## Structured Requirement

### Feature 1 — 便捷创建信息完备的 project（增强现有 `create_project` + `update_project`）

- **Goal**: 一次调用即可创建字段完备的 Linear project，并同步创建里程碑；同样字段补进 `update_project` 供后续编辑。以 catgotcha 项目的完备程度为蓝本。
- **Scope**: `src/tools/create-project.ts`、`src/tools/update-project.ts`、`src/server.ts`（tool schema 注册）、`src/graphql.ts`（mutation）、`src/types.ts`（类型）。
- **支持字段（作为参数）**: `teamId`、`name`（必填）、`icon`(emoji)、`color`(hex)、`description`(一句话摘要)、`content`(overview markdown 正文)、`startDate`、`targetDate`、`lead`、`memberIds`、`status`、`milestones: [{name, description?, targetDate?}]`。
- **形态**: 增强现有工具——`create_project` 一次调用完成建项目 + 批量建里程碑（里程碑在 Linear 是独立实体，需单独 mutation）；`update_project` 支持同样字段的后续编辑。
- **Expected Result**: 传入完整参数创建出的 project 在 Linear overview 中信息饱满（icon、颜色、描述、正文、里程碑齐全），编辑程度对齐 catgotcha。

### Feature 2 — status 本地磁盘缓存（改造 `get_status_map`）

- **Goal**: 状态映射按 teamId 持久化到磁盘 JSON 缓存；正常情况直接命中本地缓存（省网络往返）；仅在失效时回源拉取最新。
- **Scope**: `src/tools/get-status-map.ts`、新增缓存模块（磁盘持久化）、`src/tools/update-issue.ts`（提交出错回源联动）、`src/server.ts`。
- **存储形态**: 磁盘持久化 JSON，按 teamId 分键，进程重启后仍命中。
- **失效/回源触发条件**（三者）:
  1. 目标 status 名/UUID 不在缓存 → 回源刷新一次再匹配；
  2. 用缓存 UUID 提交（如 `update_issue` 改 state）出错（状态不存在/报错）→ 失效并回源重取；
  3. `get_status_map` 增可选 `refresh`/`force` 参数 → 显式绕过缓存直接回源。
- **Expected Result**: 重复取状态映射走磁盘缓存；状态被改动或提交报错后能自愈刷新，不返回过期 UUID。

## Symptoms / 现状

- `create_project` 目前仅支持 `teamId / name / icon` 三个参数；`update_project` 仅支持改 `name`。距离「信息完备」差距大。
- `get_status_map` 每次调用都实时 `fetchStatusMap` 查 GraphQL，无任何缓存。

## Acceptance（关键验收）

- Feature 1：完整字段能创建/编辑出信息饱满的 project + 里程碑。
- Feature 2：缓存命中/失效三触发行为正确、可自愈。
- `npm run build && npm test` 全绿。
- **最终验收含「成功发布」**：成功 publish 新版本（npm publish / release 流程跑通）。

## Issues with Original Prompt

- 未明确 description 与 content(overview 正文) 的区分（Linear 中是两个字段）——已在澄清中对齐为均支持。
- 缓存存储形态（磁盘 vs 内存）、失效触发点未明确——已澄清为磁盘持久化 + 三触发。

## Suggestions

- Design 阶段实地探查 catgotcha 项目（`480fe1f6c466`）的字段填充，校准「完备」的字段集与 GraphQL mutation 形态。
- 缓存路径需考虑跨项目/多 workspace 隔离（按 API key 或 workspace 分目录），避免串键。
