// src/graphql.ts
//
// Linear GraphQL API 客户端
//
// 为什么直接用 fetch 而不用 @linear/sdk？
// 1. GraphQL 让我们精确指定想要的字段——SDK 返回完整对象（含大量无用数据），
//    而手写 GraphQL 查询可以只请求需要的字段，这正是解决"上下文浪费"的关键
// 2. 零运行时依赖：不需要安装 @linear/sdk（约 2MB），MCP server 启动更快
// 3. 完全控制：我们可以精确控制每个查询返回什么，不受 SDK 封装层的限制

const LINEAR_API_URL = "https://api.linear.app/graphql";

// GraphQLFn 是工具函数接收的"客户端"类型
// 这样设计是为了方便测试：测试时传入 mock 函数，生产时传入真实客户端
export type GraphQLFn = (
  query: string,
  variables?: Record<string, unknown>
) => Promise<Record<string, unknown>>;

export function createGraphQLClient(apiKey: string): GraphQLFn {
  return async (query: string, variables: Record<string, unknown> = {}) => {
    const res = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        // Linear API 使用"Bearer-less"认证：直接传 API key 作为 Authorization 头
        // 注意：不需要加 "Bearer " 前缀，这和多数 OAuth API 不同
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      // body 包含两部分：
      // - query: GraphQL 查询字符串（如 "query { issue(id: $id) { title } }"）
      // - variables: 查询中用到的变量（如 { id: "HAT-155" }）
      // 用变量而不是字符串拼接，可以防止注入攻击（类似 SQL 的参数化查询）
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Linear API HTTP ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      data?: Record<string, unknown>;
      errors?: Array<{ message: string }>;
    };

    // GraphQL 的特殊之处：即使 HTTP 状态码是 200（成功），
    // 响应体里也可能包含 errors 数组——这表示查询本身有问题
    // 例如：字段名拼错、权限不足、ID 不存在等
    // 这和 REST API "非 200 = 出错" 的模式完全不同，需要额外检查
    if (json.errors?.length) {
      throw new Error(
        `GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`
      );
    }

    // 成功时返回 data 字段（去掉 GraphQL 的外层包装）
    return json.data ?? {};
  };
}
