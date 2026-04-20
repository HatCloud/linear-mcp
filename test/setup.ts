import type { GraphQLFn } from "../src/graphql.js";

type CallRecord = { query: string; variables: Record<string, unknown> };

export function createMockGraphQL(
  responses: Record<string, unknown>
): GraphQLFn & { calls: CallRecord[] } {
  const calls: CallRecord[] = [];

  const fn = (async (query: string, variables: Record<string, unknown> = {}) => {
    calls.push({ query, variables });
    for (const [keyword, response] of Object.entries(responses)) {
      if (query.includes(keyword)) return response;
    }
    return {};
  }) as GraphQLFn & { calls: CallRecord[] };

  fn.calls = calls;
  return fn;
}

export function lastCall(mock: { calls: CallRecord[] }): CallRecord {
  return mock.calls[mock.calls.length - 1];
}

export function nthCall(mock: { calls: CallRecord[] }, n: number): CallRecord {
  return mock.calls[n];
}
