// src/tools/create-document.ts
//
// ── 为什么这个工具存在？ ──────────────────────────────────────────────
//
// Linear 的 Document 功能用于在项目中附加较长的结构化文档，
// 例如设计文档、技术规格、会议记录等。
// 与评论（comment）不同，Document 是一个独立的实体，有自己的 URL，
// 可以单独共享和引用。文档必须属于某个项目（projectId 必填）。
//
// 典型使用场景：
//   - 把 design.md 或 plan.md 的内容同步到 Linear 项目
//   - 在项目中附加 API 设计文档
//   - 记录架构决策（ADR）
//
// ── GraphQL mutation 结构说明 ────────────────────────────────────────
//
// Linear 的 documentCreate mutation 签名：
//
//   mutation DocumentCreate($input: DocumentCreateInput!) {
//     documentCreate(input: $input) {
//       success
//       document { id url title }
//     }
//   }
//
// DocumentCreateInput 的关键字段：
//   - title: String!      — 文档标题
//   - content: String!    — 文档内容（Markdown 格式）
//   - projectId: String!  — 必填，文档所属项目的 UUID
//   - issueId: String     — 可选，关联到指定 issue（必须是 UUID）
//
// 为什么 issueId 需要特殊处理？
// documentCreate 的 issueId 字段只接受 UUID，不接受 identifier（如 "HAT-155"）。
// 这和 query { issue(id: ...) } 不同——后者两种格式都支持。
// 所以当用户传入 identifier 格式时，需要先查询转换为 UUID。
//
// ── identifier vs UUID 的检测与解析 ─────────────────────────────────
//
// UUID 的特征：包含横线，格式为 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx（8-4-4-4-12）。
// identifier 的特征：大写字母前缀 + 数字，如 "HAT-155"、"DEV-42"。
//
// 检测逻辑（与 hat-linear-ops 的 looks_like_uuid 对应）：
// 如果字符串长度 > 20 且包含多个横线，视为 UUID；否则视为 identifier，需要解析。
//
// 解析方式：调用 `query { issue(id: $id) { id } }` 获取 UUID。
// Linear 的 issue query 同时支持两种格式，这正是我们用来转换的切入点。
//
// ── 动态 input 构建的思路 ────────────────────────────────────────────
//
// title、content、projectId 是必填项。issueId 是可选的：
// - 不传 issueId：创建项目文档（不关联任何 issue）
// - 传 issueId：关联到指定 issue，文档会出现在该 issue 的 Docs 标签页
//
// 与其他写入工具一样，只在用户实际传入 issueId 时才把它加入 input，
// 避免传入 undefined 或空字符串导致 API 报错。

import type { GraphQLFn } from "../graphql.js";

// ── UUID 格式检测 ─────────────────────────────────────────────────────

// 判断字符串是否为 UUID 格式（包含多个横线且长度足够长）
// 对应 hat-linear-ops 中的 looks_like_uuid() 函数
function looksLikeUUID(s: string): boolean {
  // UUID 格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx（含 4 个横线，总长 36 字符）
  return s.length > 20 && (s.match(/-/g) ?? []).length >= 4;
}

// ── 主函数 ────────────────────────────────────────────────────────────

export async function createDocument(
  args: {
    title: string;      // 文档标题（必填）
    content: string;    // 文档内容，Markdown 格式（必填）
    projectId: string;  // 所属项目的 UUID（必填）
    issueId?: string;   // 关联的 issue：支持 UUID 或 identifier（如 "HAT-155"）
  },
  graphql: GraphQLFn
): Promise<{ id: string; url: string }> {
  // 动态构建 input 对象
  const input: Record<string, unknown> = {
    title: args.title,
    content: args.content.replace(/\\n/g, "\n"),
    projectId: args.projectId,
  };

  if (args.issueId !== undefined) {
    let resolvedIssueId = args.issueId;

    // 如果传入的不是 UUID 格式（如 "HAT-155"），先通过 query 解析为 UUID
    // 因为 documentCreate 的 issueId 字段只接受 UUID
    if (!looksLikeUUID(args.issueId)) {
      const resolveData = await graphql<{ issue?: { id: string } | null }>(
        `query ResolveIssue($id: String!) { issue(id: $id) { id } }`,
        { id: args.issueId }
      );
      const resolved = resolveData.issue?.id;
      if (!resolved) {
        throw new Error(`Could not resolve issue identifier: ${args.issueId}`);
      }
      resolvedIssueId = resolved;
    }

    input.issueId = resolvedIssueId;
  }

  const data = await graphql<{
    documentCreate?: {
      success: boolean;
      document: { id: string; url: string };
    };
  }>(
    `mutation DocumentCreate($input: DocumentCreateInput!) {
      documentCreate(input: $input) {
        success
        document { id url }
      }
    }`,
    { input }
  );

  const result = data.documentCreate;
  if (!result?.success) {
    throw new Error(`documentCreate failed for title: ${args.title}`);
  }

  const document = result.document;
  if (!document) {
    throw new Error(`documentCreate succeeded but returned no document data`);
  }
  return {
    id: document.id,
    url: document.url,
  };
}
