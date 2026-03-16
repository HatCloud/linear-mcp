// src/tools/create-comment.ts
//
// ── 为什么这个工具存在？ ──────────────────────────────────────────────
//
// 评论是 Linear issue 工作流的核心部分：
//   - 记录进度更新（"已完成 API 设计，开始编码"）
//   - 添加技术说明或决策记录
//   - 在 issue 上留下可追溯的操作记录
//
// 旧系统（hat-linear-ops post-comment）通过 stdin 读取评论内容，
// 本工具直接接受 body 参数，对 MCP 工具调用更友好。
//
// ── GraphQL mutation 结构说明 ────────────────────────────────────────
//
// Linear 的 commentCreate mutation 签名：
//
//   mutation CommentCreate($input: CommentCreateInput!) {
//     commentCreate(input: $input) {
//       success
//       comment { id createdAt }
//     }
//   }
//
// CommentCreateInput 的必填字段：
//   - issueId: String!   — 要评论的 issue UUID
//   - body: String!      — 评论内容（支持 Markdown）
//
// 为什么只返回 id 和 createdAt？
// 评论创建后，调用者通常只需要确认"评论创建成功了"以及"是什么时候创建的"，
// 不需要 body 内容（调用者刚传进来的，不用再拿回来）。
// 精简的返回值减少上下文占用。

import type { GraphQLFn } from "../graphql.js";

// ── 主函数 ────────────────────────────────────────────────────────────

export async function createComment(
  args: {
    issueId: string;  // 要评论的 issue UUID（必须是 UUID，不支持 identifier）
    body: string;     // 评论内容，支持 Markdown 格式
  },
  graphql: GraphQLFn
): Promise<{ id: string; createdAt: string }> {
  const data = await graphql<{
    commentCreate?: {
      success: boolean;
      comment: { id: string; createdAt: string };
    };
  }>(
    `mutation CommentCreate($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment { id createdAt }
      }
    }`,
    { input: { issueId: args.issueId, body: args.body.replace(/\\n/g, "\n") } }
  );

  const result = data.commentCreate;
  if (!result?.success) {
    throw new Error(`commentCreate failed for issue: ${args.issueId}`);
  }

  const comment = result.comment;
  if (!comment) {
    throw new Error(`commentCreate succeeded but returned no comment data`);
  }
  return {
    id: comment.id,
    createdAt: comment.createdAt,
  };
}
