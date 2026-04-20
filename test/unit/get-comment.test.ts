import { describe, it, expect } from "vitest";
import { getComment } from "../../src/tools/get-comment.js";
import { createMockGraphQL, lastCall } from "../setup.js";

describe("getComment", () => {
  it("fetches comment and maps user.displayName to displayName", async () => {
    const mock = createMockGraphQL({
      GetComment: {
        comment: {
          id: "comment-uuid",
          body: "This looks good!",
          createdAt: "2024-01-05T12:00:00Z",
          user: { displayName: "Alice" },
        },
      },
    });

    const result = await getComment({ id: "comment-uuid" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("comment(id: $id)");
    expect(call.variables).toMatchObject({ id: "comment-uuid" });
    expect(result).toEqual({
      id: "comment-uuid",
      body: "This looks good!",
      createdAt: "2024-01-05T12:00:00Z",
      displayName: "Alice",
    });
  });

  it("throws when comment not found", async () => {
    const mock = createMockGraphQL({ GetComment: { comment: null } });

    await expect(getComment({ id: "missing-comment" }, mock)).rejects.toThrow(
      "Comment not found: missing-comment"
    );
  });

  it("passes the id variable correctly", async () => {
    const mock = createMockGraphQL({
      GetComment: {
        comment: {
          id: "c123",
          body: "Hello",
          createdAt: "2024-01-01T00:00:00Z",
          user: { displayName: "Bob" },
        },
      },
    });

    await getComment({ id: "c123" }, mock);
    expect(lastCall(mock).variables).toMatchObject({ id: "c123" });
  });
});
