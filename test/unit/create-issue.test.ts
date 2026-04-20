import { describe, it, expect } from "vitest";
import { createIssue } from "../../src/tools/create-issue.js";
import { createMockGraphQL, lastCall } from "../setup.js";

const successResponse = {
  issueCreate: {
    success: true,
    issue: { id: "new-issue-id", identifier: "HAT-100", title: "Fix login", url: "https://linear.app/hat/issue/HAT-100" },
  },
};

describe("createIssue", () => {
  it("sends required fields teamId and title", async () => {
    const mock = createMockGraphQL({ IssueCreate: successResponse });

    const result = await createIssue({ teamId: "team-uuid", title: "Fix login" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("IssueCreate");
    expect(call.query).toContain("$input: IssueCreateInput!");
    expect(call.variables.input).toMatchObject({ teamId: "team-uuid", title: "Fix login" });
    expect(result).toEqual({
      id: "new-issue-id",
      identifier: "HAT-100",
      title: "Fix login",
      url: "https://linear.app/hat/issue/HAT-100",
    });
  });

  it("normalizes \\\\n to newlines in description", async () => {
    const mock = createMockGraphQL({ IssueCreate: successResponse });

    await createIssue({ teamId: "team-uuid", title: "Fix", description: "Line1\\nLine2" }, mock);
    const call = lastCall(mock);
    const input = call.variables.input as Record<string, unknown>;

    expect(input.description).toBe("Line1\nLine2");
  });

  it("maps state to stateId in input", async () => {
    const mock = createMockGraphQL({ IssueCreate: successResponse });

    await createIssue({ teamId: "team-uuid", title: "Fix", state: "state-uuid" }, mock);
    const call = lastCall(mock);
    const input = call.variables.input as Record<string, unknown>;

    expect(input.stateId).toBe("state-uuid");
    expect(input.state).toBeUndefined();
  });

  it("maps assignee to assigneeId in input", async () => {
    const mock = createMockGraphQL({ IssueCreate: successResponse });

    await createIssue({ teamId: "team-uuid", title: "Fix", assignee: "user-uuid" }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(input.assigneeId).toBe("user-uuid");
    expect(input.assignee).toBeUndefined();
  });

  it("includes optional fields when provided", async () => {
    const mock = createMockGraphQL({ IssueCreate: successResponse });

    await createIssue({
      teamId: "team-uuid",
      title: "Fix",
      projectId: "proj-uuid",
      priority: 2,
    }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(input.projectId).toBe("proj-uuid");
    expect(input.priority).toBe(2);
  });

  it("throws when issueCreate returns success=false", async () => {
    const mock = createMockGraphQL({
      IssueCreate: { issueCreate: { success: false, issue: null } },
    });

    await expect(
      createIssue({ teamId: "bad-team", title: "x" }, mock)
    ).rejects.toThrow("issueCreate failed");
  });
});
