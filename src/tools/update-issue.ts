// src/tools/update-issue.ts
//
// ── 为什么这个工具存在？ ──────────────────────────────────────────────
//
// 开发过程中最常见的操作之一是"把这个 issue 标记为已完成"或"修改标题"。
// 旧系统（hat-linear-ops）的 update-status 只能改状态，无法一次性修改
// title/description/assignee/priority 等字段。
//
// 本工具统一了所有 issue 字段的更新，一次调用可以同时修改多个字段。
//
// ── GraphQL mutation 结构说明 ────────────────────────────────────────
//
// Linear 的 issueUpdate mutation 签名：
//
//   mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
//     issueUpdate(id: $id, input: $input) {
//       success
//       issue { id identifier title state { name } }
//     }
//   }
//
// 为什么 id 单独传而不是放在 input 里？
// 这是 Linear API 的设计：id 是"要更新哪个 issue"（路由参数），
// input 是"要改成什么"（数据），分离职责。
//
// 注意：id 必须是 UUID（如 "1de25fc9-xxx"），不支持 identifier（"HAT-155"）。
// 这是 issueUpdate mutation 的 API 约束，与 query 接口不同。
//
// ── 动态 input 构建的思路 ────────────────────────────────────────────
//
// 关键设计：只把用户实际传入的字段放进 input 对象。
//
// 为什么这很重要？如果某个字段不在 input 里，Linear 不会动它。
// 但如果用户没传 description 我们却把 undefined 放进 input，
// Linear 可能会把 description 清空——这是 API 的"undefined vs absent"问题。
//
// TypeScript 的 undefined 会被 JSON.stringify 丢弃，但明确写出
// `input.description = undefined` 和"根本不写 description"是不一样的。
// 所以我们用条件判断，只在用户真正传了值时才设置对应字段：
//
//   const input: Record<string, unknown> = {};
//   if (args.state !== undefined) input.stateId = args.state;
//   if (args.description !== undefined) input.description = args.description;
//   // ...
//
// 这样 input 里只包含用户明确想修改的字段，不会意外覆盖其他字段。
//
// parentId 比较特殊：null 是一个合法的值（表示"移除父 issue"），
// 所以用 `args.parentId !== undefined` 而不是 `args.parentId` 来判断是否传入。

import type { GraphQLFn } from "../graphql.js";

// ── 主函数 ────────────────────────────────────────────────────────────

export async function updateIssue(
  args: {
    id: string;           // issue UUID（必须是 UUID，mutation 不支持 identifier）
    state?: string;       // 新状态 UUID（不是名称）——通过 getStatusMap 获取
    description?: string; // issue 描述（Markdown 格式）
    assignee?: string;    // 负责人的用户 UUID
    title?: string;       // issue 标题
    priority?: number;    // 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
    parentId?: string | null;  // 父 issue UUID；null 表示移除父级关系
  },
  graphql: GraphQLFn
): Promise<{ id: string; identifier: string; title: string; state: string }> {
  // 动态构建 input 对象：只包含用户实际传入的字段
  // 不传的字段不加入 input，避免意外覆盖 Linear 中现有的值
  const input: Record<string, unknown> = {};

  if (args.state !== undefined) {
    // Linear API 中状态字段名是 stateId（而不是 state），
    // 因为 state 是对象，stateId 才是设置状态用的 UUID
    input.stateId = args.state;
  }
  if (args.description !== undefined) {
    input.description = args.description;
  }
  if (args.assignee !== undefined) {
    // 同样，Linear API 用 assigneeId（UUID），而不是 assignee 对象
    input.assigneeId = args.assignee;
  }
  if (args.title !== undefined) {
    input.title = args.title;
  }
  if (args.priority !== undefined) {
    input.priority = args.priority;
  }
  if (args.parentId !== undefined) {
    // parentId 可以为 null（移除父级），也可以为 UUID（设置父级）
    // 必须用 !== undefined 而不是 if (args.parentId)，因为 null 是合法值
    input.parentId = args.parentId;
  }

  if (Object.keys(input).length === 0) {
    throw new Error("updateIssue: 没有提供任何要更新的字段");
  }

  const data = await graphql<{
    issueUpdate?: {
      success: boolean;
      issue: { id: string; identifier: string; title: string; state: { name: string } };
    };
  }>(
    `mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue { id identifier title state { name } }
      }
    }`,
    { id: args.id, input }
  );

  const result = data.issueUpdate;
  if (!result?.success) {
    throw new Error(`issueUpdate failed for id: ${args.id}`);
  }

  const issue = result.issue;
  if (!issue) {
    throw new Error(`issueUpdate succeeded but returned no issue data`);
  }
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    state: issue.state.name,
  };
}
