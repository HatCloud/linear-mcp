import { describe, it, expect } from "vitest";
import { createComment } from "../../src/tools/create-comment.js";
import { createMockGraphQL, lastCall } from "../setup.js";

const successResponse = {
  commentCreate: {
    success: true,
    comment: { id: "comment-new", createdAt: "2024-01-10T00:00:00Z" },
  },
};

describe("createComment", () => {
  it("sends issueId and body in input", async () => {
    const mock = createMockGraphQL({ CommentCreate: successResponse });

    const result = await createComment({ issueId: "issue-uuid", body: "Hello!" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("CommentCreate");
    expect(call.query).toContain("$input: CommentCreateInput!");
    expect(call.variables.input).toMatchObject({ issueId: "issue-uuid", body: "Hello!" });
    expect(result).toEqual({ id: "comment-new", createdAt: "2024-01-10T00:00:00Z" });
  });

  it("normalizes \\\\n in body", async () => {
    const mock = createMockGraphQL({ CommentCreate: successResponse });

    await createComment({ issueId: "issue-uuid", body: "Line1\\nLine2" }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(input.body).toBe("Line1\nLine2");
  });

  it("throws when commentCreate returns success=false", async () => {
    const mock = createMockGraphQL({
      CommentCreate: { commentCreate: { success: false, comment: null } },
    });

    await expect(
      createComment({ issueId: "bad-issue", body: "x" }, mock)
    ).rejects.toThrow("commentCreate failed");
  });
});
