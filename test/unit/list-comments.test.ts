import { describe, it, expect } from "vitest";
import { listComments } from "../../src/tools/list-comments.js";
import { createMockGraphQL, lastCall } from "../setup.js";

describe("listComments", () => {
  it("passes issueId and uses $issueId: ID! variable type", async () => {
    const mock = createMockGraphQL({
      ListComments: {
        comments: {
          nodes: [
            { id: "c1", body: "Hello", createdAt: "2024-01-01T00:00:00Z", user: { displayName: "Alice" } },
          ],
        },
      },
    });

    const result = await listComments({ issueId: "issue-uuid-123" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("$issueId: ID!");
    expect(call.variables).toMatchObject({ issueId: "issue-uuid-123" });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "c1",
      body: "Hello",
      createdAt: "2024-01-01T00:00:00Z",
      displayName: "Alice",
    });
  });

  it("maps user.displayName to displayName at top level", async () => {
    const mock = createMockGraphQL({
      ListComments: {
        comments: {
          nodes: [
            { id: "c1", body: "First", createdAt: "2024-01-01T00:00:00Z", user: { displayName: "Bob" } },
            { id: "c2", body: "Second", createdAt: "2024-01-02T00:00:00Z", user: { displayName: "Carol" } },
          ],
        },
      },
    });

    const result = await listComments({ issueId: "issue-uuid-123" }, mock);

    expect(result[0].displayName).toBe("Bob");
    expect(result[1].displayName).toBe("Carol");
  });

  it("returns empty array when no comments", async () => {
    const mock = createMockGraphQL({ ListComments: { comments: { nodes: [] } } });
    const result = await listComments({ issueId: "no-comments" }, mock);
    expect(result).toEqual([]);
  });

  it("clamps limit to max 50", async () => {
    const mock = createMockGraphQL({ ListComments: { comments: { nodes: [] } } });
    await listComments({ issueId: "x", limit: 200 }, mock);
    expect(lastCall(mock).variables).toMatchObject({ limit: 50 });
  });
});
