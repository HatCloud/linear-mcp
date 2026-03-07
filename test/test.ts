// test/test.ts
//
// linear-mcp 读取工具测试套件
//
// 测试分两类：
//
// 【Unit 测试（离线）】
// 使用 mock graphql 函数，不需要网络，验证：
//   - getIssue 的响应转换逻辑（labels 展平、comments 重命名、priority 合并）
//   - listIssues 的响应转换逻辑（parent 展平、priority 合并）
//   - getStatusMap 的映射构建（name→UUID、all 完整列表）
//   - getStatusMap 的 team key 解析逻辑
//
// 【Live 测试（在线，需要 --live 参数）】
// 使用真实 LINEAR_API_KEY 调用 Linear API，验证：
//   - getIssue 能拿到 HAT-155 的真实数据
//   - listIssues 能按项目过滤
//   - getStatusMap 能用 team key "HAT" 获取状态映射
//
// 运行方式：
//   npm test              # 仅 unit 测试
//   npm run test:live     # unit + live（需要设置 LINEAR_API_KEY）
//
// 遵循 __REPORT__ 协议（与 things-mcp/test.ts 相同），
// 供 doctor 脚本解析汇总测试结果。

import assert from "node:assert";
import { getIssue } from "../src/tools/get-issue.js";
import { listIssues } from "../src/tools/list-issues.js";
import { getStatusMap } from "../src/tools/get-status-map.js";
import type { GraphQLFn } from "../src/graphql.js";

// ─── Test Harness ───────────────────────────────────────────────────

const startTime = Date.now();
let passed = 0;
let failed = 0;
let skipped = 0;
const testResults: Array<{ name: string; status: "pass" | "fail" | "skip"; error?: string }> = [];

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
    testResults.push({ name, status: "pass" });
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${(e as Error).message}`);
    failed++;
    testResults.push({ name, status: "fail", error: (e as Error).message });
  }
}

function skip(name: string, reason?: string) {
  console.log(`  - ${name}${reason ? ` (${reason})` : ""}`);
  skipped++;
  testResults.push({ name, status: "skip" });
}

const isLive = process.argv.includes("--live");

// ─── Mock 数据 ──────────────────────────────────────────────────────
//
// 模拟 Linear API 返回的原始 GraphQL 结构
// 注意：这里的结构完全模拟真实 API，包含嵌套的 nodes 数组等

const MOCK_ISSUE_RAW = {
  id: "test-uuid-001",
  identifier: "HAT-155",
  title: "实现 linear-mcp read tools",
  description: "包含 get_issue、list_issues、get_status_map 三个工具",
  state: { id: "state-uuid-001", name: "In Progress", type: "started" },
  priority: 3,
  priorityLabel: "Normal",
  url: "https://linear.app/hatcloud/issue/HAT-155",
  createdAt: "2026-03-08T00:00:00.000Z",
  updatedAt: "2026-03-08T12:00:00.000Z",
  assignee: { id: "user-uuid-001", displayName: "hatcloud" },
  team: { id: "team-uuid-001", name: "Hat Studio", key: "HAT" },
  project: { id: "proj-uuid-001", name: "Ghost-in-the-Shell" },
  labels: { nodes: [{ name: "feature" }, { name: "mcp" }] },
  comments: {
    nodes: [
      {
        id: "comment-uuid-001",
        body: "这个工具很重要",
        createdAt: "2026-03-08T06:00:00.000Z",
        user: { displayName: "hatcloud" },
      },
    ],
  },
  children: {
    nodes: [
      {
        id: "child-uuid-001",
        identifier: "HAT-156",
        title: "子任务示例",
        state: { name: "Backlog", type: "backlog" },
        priority: 0,
        priorityLabel: "No priority",
      },
    ],
  },
};

// ─── Unit: getIssue 响应转换 ────────────────────────────────────────

console.log("\n[Unit] getIssue — 响应转换");

// Mock graphql 函数：无论收到什么查询，都返回预设的 MOCK_ISSUE_RAW
const mockGetIssue: GraphQLFn = async () => ({ issue: MOCK_ISSUE_RAW });

// Mock：模拟 issue 不存在的情况
const mockIssueNotFound: GraphQLFn = async () => ({ issue: null });

await test("getIssue: id 和基础字段正确", async () => {
  const result = await getIssue({ id: "HAT-155" }, mockGetIssue);
  assert.equal(result.id, "test-uuid-001");
  assert.equal(result.identifier, "HAT-155");
  assert.equal(result.title, "实现 linear-mcp read tools");
  assert.equal(result.url, "https://linear.app/hatcloud/issue/HAT-155");
});

await test("getIssue: labels 被展平为 string[]（去掉 nodes 包装）", async () => {
  const result = await getIssue({ id: "HAT-155" }, mockGetIssue);
  // 应该是 ["feature", "mcp"]，而不是 [{ name: "feature" }, ...]
  assert.deepEqual(result.labels, ["feature", "mcp"]);
  assert(typeof result.labels[0] === "string", "labels 元素应为字符串");
});

await test("getIssue: priority 合并为 { value, name } 对象", async () => {
  const result = await getIssue({ id: "HAT-155" }, mockGetIssue);
  // { priority: 3, priorityLabel: "Normal" } → { value: 3, name: "Normal" }
  assert.deepEqual(result.priority, { value: 3, name: "Normal" });
});

await test("getIssue: state 包含 name 和 type", async () => {
  const result = await getIssue({ id: "HAT-155" }, mockGetIssue);
  assert.equal(result.state.name, "In Progress");
  assert.equal(result.state.type, "started");
});

await test("getIssue: 不传 comments 参数时，result.comments 为 undefined", async () => {
  const result = await getIssue({ id: "HAT-155" }, mockGetIssue);
  // 默认不请求 comments，结果中不应有此字段
  assert.equal(result.comments, undefined);
});

await test("getIssue: comments=true 时，comments 被展平并重命名字段", async () => {
  const result = await getIssue({ id: "HAT-155", comments: true }, mockGetIssue);
  assert(Array.isArray(result.comments));
  assert.equal(result.comments!.length, 1);
  const c = result.comments![0];
  assert.equal(c.id, "comment-uuid-001");
  assert.equal(c.body, "这个工具很重要");
  assert.equal(c.author, "hatcloud");  // displayName → author
  assert.equal(c.createdAt, "2026-03-08T06:00:00.000Z");
});

await test("getIssue: sub_issues=true 时，subIssues 被展平并转换 priority", async () => {
  const result = await getIssue({ id: "HAT-155", sub_issues: true }, mockGetIssue);
  assert(Array.isArray(result.subIssues));
  assert.equal(result.subIssues!.length, 1);
  const s = result.subIssues![0];
  assert.equal(s.identifier, "HAT-156");
  // priority 同样合并为对象格式
  assert.deepEqual(s.priority, { value: 0, name: "No priority" });
});

await test("getIssue: issue 不存在时抛出错误", async () => {
  await assert.rejects(
    () => getIssue({ id: "HAT-999" }, mockIssueNotFound),
    /Issue not found/
  );
});

// ─── Unit: listIssues 响应转换 ──────────────────────────────────────

console.log("\n[Unit] listIssues — 响应转换");

const MOCK_LIST_RAW = [
  {
    id: "issue-uuid-001",
    identifier: "HAT-100",
    title: "已完成任务",
    priority: 2,
    priorityLabel: "High",
    state: { name: "Done", type: "completed" },
    assignee: { displayName: "hatcloud" },
    parent: null,
  },
  {
    id: "issue-uuid-002",
    identifier: "HAT-101",
    title: "子任务",
    priority: 3,
    priorityLabel: "Normal",
    state: { name: "In Progress", type: "started" },
    assignee: null,
    parent: { id: "parent-uuid-001" },
  },
];

const mockListIssues: GraphQLFn = async () => ({
  issues: { nodes: MOCK_LIST_RAW },
});

await test("listIssues: 返回正确数量的 items", async () => {
  const result = await listIssues({}, mockListIssues);
  assert.equal(result.length, 2);
});

await test("listIssues: priority 合并为 { value, name } 对象", async () => {
  const result = await listIssues({}, mockListIssues);
  assert.deepEqual(result[0].priority, { value: 2, name: "High" });
  assert.deepEqual(result[1].priority, { value: 3, name: "Normal" });
});

await test("listIssues: parent 展平为 parentId 字符串", async () => {
  const result = await listIssues({}, mockListIssues);
  // 有 parent 的 issue
  assert.equal(result[1].parentId, "parent-uuid-001");
});

await test("listIssues: 无 parent 时 parentId 为 null", async () => {
  const result = await listIssues({}, mockListIssues);
  assert.equal(result[0].parentId, null);
});

await test("listIssues: assignee 展平为 displayName 字符串", async () => {
  const result = await listIssues({}, mockListIssues);
  assert.equal(result[0].assignee, "hatcloud");
});

await test("listIssues: 无 assignee 时为 undefined", async () => {
  const result = await listIssues({}, mockListIssues);
  assert.equal(result[1].assignee, undefined);
});

await test("listIssues: 空结果时返回空数组", async () => {
  const mockEmpty: GraphQLFn = async () => ({ issues: { nodes: [] } });
  const result = await listIssues({}, mockEmpty);
  assert.deepEqual(result, []);
});

// ─── Unit: listIssues limit 限制 ───────────────────────────────────

console.log("\n[Unit] listIssues — limit 参数验证");

await test("listIssues: limit 超过 50 时被截断为 50", async () => {
  // 验证传给 graphql 的变量中 limit 不超过 50
  let capturedVariables: Record<string, unknown> = {};
  const mockCapture: GraphQLFn = async (_query, variables = {}) => {
    capturedVariables = variables;
    return { issues: { nodes: [] } };
  };
  await listIssues({ limit: 100 }, mockCapture);
  assert.equal(capturedVariables.limit, 50, "limit 应该被截断为 50");
});

await test("listIssues: 默认 limit 为 25", async () => {
  let capturedVariables: Record<string, unknown> = {};
  const mockCapture: GraphQLFn = async (_query, variables = {}) => {
    capturedVariables = variables;
    return { issues: { nodes: [] } };
  };
  await listIssues({}, mockCapture);
  assert.equal(capturedVariables.limit, 25, "默认 limit 应该是 25");
});

// ─── Unit: getStatusMap ─────────────────────────────────────────────

console.log("\n[Unit] getStatusMap — 映射构建");

const MOCK_STATES = [
  { id: "state-backlog-uuid", name: "Backlog", type: "backlog" },
  { id: "state-started-uuid", name: "In Progress", type: "started" },
  { id: "state-review-uuid", name: "In Review", type: "started" },
  { id: "state-done-uuid", name: "Done", type: "completed" },
  { id: "state-canceled-uuid", name: "Canceled", type: "canceled" },
];

// mock：接受 UUID，直接返回状态列表
const mockStatusMapByUUID: GraphQLFn = async (_query, variables = {}) => {
  // 如果是查 teams（team key 解析），返回空
  if (_query.includes("teams {")) {
    return { teams: { nodes: [] } };
  }
  return { workflowStates: { nodes: MOCK_STATES } };
};

// mock：支持 team key "HAT" → UUID 解析
const mockStatusMapByKey: GraphQLFn = async (_query, variables = {}) => {
  if (_query.includes("teams {")) {
    return {
      teams: {
        nodes: [
          { id: "team-hat-uuid", key: "HAT" },
          { id: "team-dev-uuid", key: "DEV" },
        ],
      },
    };
  }
  return { workflowStates: { nodes: MOCK_STATES } };
};

await test("getStatusMap: 每个状态名称对应正确的 UUID", async () => {
  const result = await getStatusMap({ team: "team-hat-uuid" }, mockStatusMapByUUID);
  assert.equal(result.map["Backlog"], "state-backlog-uuid");
  assert.equal(result.map["In Progress"], "state-started-uuid");
  assert.equal(result.map["Done"], "state-done-uuid");
  assert.equal(result.map["Canceled"], "state-canceled-uuid");
});

await test("getStatusMap: 包含 all 字段（完整状态列表）", async () => {
  const result = await getStatusMap({ team: "team-hat-uuid" }, mockStatusMapByUUID);
  assert(Array.isArray(result.all), "all 应该是数组");
  assert.equal(result.all.length, 5, "应该包含全部 5 个状态");
  // 验证 all 中的每个元素都有 id、name、type
  for (const s of result.all) {
    assert(s.id, "每个状态应有 id");
    assert(s.name, "每个状态应有 name");
    assert(s.type, "每个状态应有 type");
  }
});

await test("getStatusMap: team key 'HAT' 能解析为 UUID", async () => {
  // HAT 是短字符串（无横线，长度<=10），应触发 key 解析流程
  const result = await getStatusMap({ team: "HAT" }, mockStatusMapByKey);
  // 解析成功后应有正确的状态映射
  assert.equal(result.map["Done"], "state-done-uuid");
});

await test("getStatusMap: team key 大小写不敏感", async () => {
  // "hat" 小写应该也能匹配 "HAT"
  const result = await getStatusMap({ team: "hat" }, mockStatusMapByKey);
  assert.equal(result.map["In Progress"], "state-started-uuid");
});

await test("getStatusMap: 未知 team key 抛出错误", async () => {
  const mockUnknownKey: GraphQLFn = async (_query) => {
    if (_query.includes("teams {")) {
      return { teams: { nodes: [{ id: "team-hat-uuid", key: "HAT" }] } };
    }
    return { workflowStates: { nodes: [] } };
  };
  await assert.rejects(
    () => getStatusMap({ team: "UNKNOWN" }, mockUnknownKey),
    /Team key "UNKNOWN" not found/
  );
});

// ─── Live 测试（需要 --live 参数和 LINEAR_API_KEY）──────────────────

console.log("\n[Live] 真实 Linear API 调用");

if (!isLive) {
  skip("getIssue: HAT-155（跳过，需要 --live）");
  skip("listIssues: Ghost-in-the-Shell 项目（跳过，需要 --live）");
  skip("getStatusMap: team key 'HAT'（跳过，需要 --live）");
} else {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    skip("所有 live 测试（LINEAR_API_KEY 未设置）");
  } else {
    const { createGraphQLClient } = await import("../src/graphql.js");
    const graphql = createGraphQLClient(apiKey);

    await test("getIssue: 能获取 HAT-155 的真实数据", async () => {
      const result = await getIssue(
        { id: "HAT-155", comments: true, sub_issues: true },
        graphql
      );
      assert(result.id, "应有 id");
      assert.equal(result.identifier, "HAT-155");
      assert(result.title, "应有 title");
      assert(Array.isArray(result.labels), "labels 应为数组");
      // comments 和 subIssues 可为空数组但不应是 undefined
      assert(Array.isArray(result.comments), "comments 应为数组");
      assert(Array.isArray(result.subIssues), "subIssues 应为数组");
      console.log(`    标题: ${result.title}`);
      console.log(`    状态: ${result.state.name} (${result.state.type})`);
      console.log(`    优先级: ${result.priority.name}`);
      console.log(`    标签: [${result.labels.join(", ")}]`);
      console.log(`    评论数: ${result.comments!.length}`);
      console.log(`    子任务数: ${result.subIssues!.length}`);
    });

    await test("listIssues: Ghost-in-the-Shell 项目列表格式正确", async () => {
      const result = await listIssues(
        { project: "Ghost-in-the-Shell", limit: 5 },
        graphql
      );
      assert(Array.isArray(result), "应返回数组");
      console.log(`    获取到 ${result.length} 个 issues`);
      for (const item of result) {
        assert(item.id, "每个 item 应有 id");
        assert(item.identifier, "每个 item 应有 identifier");
        assert(item.title, "每个 item 应有 title");
        assert(typeof item.priority.value === "number", "priority.value 应为数字");
        assert(item.state.name, "state.name 应存在");
      }
      if (result.length > 0) {
        console.log(`    第一个: ${result[0].identifier} - ${result[0].title}`);
      }
    });

    await test("getStatusMap: team key 'HAT' 获取状态映射", async () => {
      const result = await getStatusMap({ team: "HAT" }, graphql);
      assert(Object.keys(result.map).length > 0, "map 应有多个状态");
      assert(Array.isArray(result.all), "all 应为数组");
      assert(result.all.length > 0, "all 应包含状态");
      console.log(`    状态列表: ${Object.keys(result.map).join(", ")}`);
    });
  }
}

// ─── Summary ────────────────────────────────────────────────────────

const report = {
  module: "linear-mcp",
  passed,
  failed,
  skipped,
  tests: testResults,
  durationMs: Date.now() - startTime,
};

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log(`\n__REPORT__\n${JSON.stringify(report)}`);

if (failed > 0) process.exit(1);
