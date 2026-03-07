// src/tools/create-issue.ts
//
// ── 为什么这个工具存在？ ──────────────────────────────────────────────
//
// 在开发工作流中，经常需要从 skills 里快速创建 issue，
// 例如"把这个 TODO 转成 Linear issue"或"给这个 bug 创建跟踪任务"。
//
// 旧系统（hat-linear-ops create-issue）通过动态拼接 GraphQL 字符串实现可选参数，
// 需要手动维护 var_defs 和 input_fields 字符串拼接，容易出错。
//
// TypeScript 版本用更优雅的方式解决：mutation 字符串固定，
// 只是 input 对象（JavaScript 对象）动态组装——不含的字段根本不出现在对象里，
// JSON.stringify 时自然忽略 undefined 值。
//
// ── GraphQL mutation 结构说明 ────────────────────────────────────────
//
// Linear 的 issueCreate mutation 签名：
//
//   mutation IssueCreate($input: IssueCreateInput!) {
//     issueCreate(input: $input) {
//       success
//       issue { id identifier title url }
//     }
//   }
//
// 与 issueUpdate 不同，issueCreate 只有一个参数 $input，没有单独的 $id。
// 因为创建时还不存在 id——所有内容（包括 teamId、title）都在 input 里。
//
// IssueCreateInput 的必填字段只有 teamId 和 title，其余都是可选的。
//
// ── 动态 input 构建的思路 ────────────────────────────────────────────
//
// 与 updateIssue 相同的原则：只把用户实际传入的字段放进 input 对象。
//
// 在 TypeScript 中，可以利用展开运算符和三元表达式：
//
//   const input = {
//     teamId: args.teamId,
//     title: args.title,
//     ...(args.description !== undefined ? { description: args.description } : {}),
//     // ...
//   };
//
// 或者用命令式的 if 语句逐个赋值（更易读，与 updateIssue 保持一致风格）。
// 两种方式等效，这里选择命令式，便于维护。
//
// ── Python vs TypeScript 的对比 ──────────────────────────────────────
//
// Python 版（hat-linear-ops）需要手动拼接 GraphQL 字符串：
//   var_defs += ", $projectId: String!"
//   input_fields += ", projectId: $projectId"
// 这样做是因为 Python 的 GraphQL 请求只能通过字符串构造查询。
//
// TypeScript 版不需要这样做：
// - mutation 字符串是固定的（$input: IssueCreateInput!）
// - input 是 JavaScript 对象，缺失的字段天然不出现在序列化结果里
// 这大大简化了代码，也消除了字符串拼接的潜在错误。

import type { GraphQLFn } from "../graphql.js";

// ── 主函数 ────────────────────────────────────────────────────────────

export async function createIssue(
  args: {
    teamId: string;        // 必填：issue 所属的 team UUID
    title: string;         // 必填：issue 标题
    description?: string;  // 可选：描述（Markdown 格式）
    projectId?: string;    // 可选：关联到指定 project UUID
    state?: string;        // 可选：初始状态 UUID（不传则用 team 的默认状态）
    assignee?: string;     // 可选：负责人 UUID
    priority?: number;     // 可选：0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
  },
  graphql: GraphQLFn
): Promise<{ id: string; identifier: string; title: string; url: string }> {
  // 动态构建 input 对象：teamId 和 title 是必填项，其余按需加入
  // Linear API 的 IssueCreateInput 类型定义了所有可选字段，
  // 不传的字段 Linear 会使用 team 的默认值
  const input: Record<string, unknown> = {
    teamId: args.teamId,
    title: args.title,
  };

  if (args.description !== undefined) {
    input.description = args.description;
  }
  if (args.projectId !== undefined) {
    input.projectId = args.projectId;
  }
  if (args.state !== undefined) {
    // 字段名是 stateId（UUID），而不是 state（对象）
    input.stateId = args.state;
  }
  if (args.assignee !== undefined) {
    // 字段名是 assigneeId（UUID），而不是 assignee（对象）
    input.assigneeId = args.assignee;
  }
  if (args.priority !== undefined) {
    input.priority = args.priority;
  }

  const data = await graphql<{
    issueCreate?: {
      success: boolean;
      issue: { id: string; identifier: string; title: string; url: string };
    };
  }>(
    `mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier title url }
      }
    }`,
    { input }
  );

  const result = data.issueCreate;
  if (!result?.success) {
    throw new Error(`issueCreate failed for team: ${args.teamId}`);
  }

  const issue = result.issue;
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
  };
}
