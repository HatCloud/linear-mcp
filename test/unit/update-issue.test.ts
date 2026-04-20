import { describe, it, expect } from "vitest";
import { updateIssue } from "../../src/tools/update-issue.js";
import { createMockGraphQL, lastCall } from "../setup.js";

const successResponse = {
  issueUpdate: {
    success: true,
    issue: { id: "issue-1", identifier: "HAT-42", title: "Fixed", state: { name: "Done" } },
  },
};

describe("updateIssue", () => {
  it("builds dynamic input with only provided fields", async () => {
    const mock = createMockGraphQL({ UpdateIssue: successResponse });

    await updateIssue({ id: "issue-1", title: "New Title" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("UpdateIssue");
    expect(call.query).toContain("$id: String!");
    expect(call.variables).toMatchObject({ id: "issue-1" });
    const input = call.variables.input as Record<string, unknown>;
    expect(input.title).toBe("New Title");
    expect(Object.keys(input)).toEqual(["title"]);
  });

  it("maps state to stateId in input", async () => {
    const mock = createMockGraphQL({ UpdateIssue: successResponse });

    await updateIssue({ id: "issue-1", state: "state-uuid" }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(input.stateId).toBe("state-uuid");
    expect(input.state).toBeUndefined();
  });

  it("maps assignee to assigneeId in input", async () => {
    const mock = createMockGraphQL({ UpdateIssue: successResponse });

    await updateIssue({ id: "issue-1", assignee: "user-uuid" }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(input.assigneeId).toBe("user-uuid");
    expect(input.assignee).toBeUndefined();
  });

  it("normalizes \\\\n in description", async () => {
    const mock = createMockGraphQL({ UpdateIssue: successResponse });

    await updateIssue({ id: "issue-1", description: "Line1\\nLine2" }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(input.description).toBe("Line1\nLine2");
  });

  it("allows parentId to be null (remove parent)", async () => {
    const mock = createMockGraphQL({ UpdateIssue: successResponse });

    await updateIssue({ id: "issue-1", parentId: null }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(input.parentId).toBeNull();
  });

  it("throws when no fields provided", async () => {
    const mock = createMockGraphQL({ UpdateIssue: successResponse });

    await expect(updateIssue({ id: "issue-1" }, mock)).rejects.toThrow(
      "没有提供任何要更新的字段"
    );
  });

  it("throws when issueUpdate returns success=false", async () => {
    const mock = createMockGraphQL({
      UpdateIssue: { issueUpdate: { success: false, issue: null } },
    });

    await expect(
      updateIssue({ id: "issue-1", title: "x" }, mock)
    ).rejects.toThrow("issueUpdate failed");
  });

  it("returns flattened state name in result", async () => {
    const mock = createMockGraphQL({ UpdateIssue: successResponse });

    const result = await updateIssue({ id: "issue-1", title: "Fixed" }, mock);
    expect(result.state).toBe("Done");
  });
});
