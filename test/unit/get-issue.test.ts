import { describe, it, expect } from "vitest";
import { getIssue } from "../../src/tools/get-issue.js";
import { createMockGraphQL, lastCall } from "../setup.js";

const rawIssue = {
  id: "issue-uuid-1",
  identifier: "HAT-42",
  title: "Fix login bug",
  description: "Users cannot log in",
  state: { id: "state-1", name: "In Progress", type: "started" },
  priority: 2,
  priorityLabel: "High",
  url: "https://linear.app/hat/issue/HAT-42",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-02T00:00:00Z",
  assignee: { id: "user-1", displayName: "Alice" },
  team: { id: "team-1", name: "Hat Studio", key: "HAT" },
  project: { id: "proj-1", name: "Core" },
  labels: { nodes: [{ name: "bug" }, { name: "urgent" }] },
};

describe("getIssue", () => {
  it("flattens labels.nodes to string array", async () => {
    const mock = createMockGraphQL({ GetIssue: { issue: rawIssue } });

    const result = await getIssue({ id: "HAT-42" }, mock);

    expect(result.labels).toEqual(["bug", "urgent"]);
  });

  it("merges priority fields into single object", async () => {
    const mock = createMockGraphQL({ GetIssue: { issue: rawIssue } });

    const result = await getIssue({ id: "HAT-42" }, mock);

    expect(result.priority).toEqual({ value: 2, name: "High" });
  });

  it("does not include comments field unless requested", async () => {
    const mock = createMockGraphQL({ GetIssue: { issue: rawIssue } });

    const result = await getIssue({ id: "HAT-42" }, mock);
    const call = lastCall(mock);

    expect(call.query).not.toContain("comments {");
    expect(result.comments).toBeUndefined();
  });

  it("includes comments when comments=true", async () => {
    const issueWithComments = {
      ...rawIssue,
      comments: {
        nodes: [
          { id: "c1", body: "Looks good", createdAt: "2024-01-03T00:00:00Z", user: { displayName: "Bob" } },
        ],
      },
    };
    const mock = createMockGraphQL({ GetIssue: { issue: issueWithComments } });

    const result = await getIssue({ id: "HAT-42", comments: true }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("comments {");
    expect(result.comments).toHaveLength(1);
    expect(result.comments![0]).toEqual({
      id: "c1",
      body: "Looks good",
      createdAt: "2024-01-03T00:00:00Z",
      author: "Bob",
    });
  });

  it("renames user.displayName to author in comments", async () => {
    const issueWithComments = {
      ...rawIssue,
      comments: {
        nodes: [
          { id: "c1", body: "Hello", createdAt: "2024-01-03T00:00:00Z", user: { displayName: "Carol" } },
        ],
      },
    };
    const mock = createMockGraphQL({ GetIssue: { issue: issueWithComments } });

    const result = await getIssue({ id: "HAT-42", comments: true }, mock);
    expect(result.comments![0].author).toBe("Carol");
  });

  it("includes sub-issues when sub_issues=true", async () => {
    const issueWithChildren = {
      ...rawIssue,
      children: {
        nodes: [
          { id: "sub-1", identifier: "HAT-43", title: "Sub task", state: { name: "Backlog", type: "backlog" }, priority: 0, priorityLabel: "None" },
        ],
      },
    };
    const mock = createMockGraphQL({ GetIssue: { issue: issueWithChildren } });

    const result = await getIssue({ id: "HAT-42", sub_issues: true }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("children {");
    expect(result.subIssues).toHaveLength(1);
    expect(result.subIssues![0]).toMatchObject({
      id: "sub-1",
      identifier: "HAT-43",
      title: "Sub task",
      priority: { value: 0, name: "None" },
    });
  });

  it("throws when issue not found", async () => {
    const mock = createMockGraphQL({ GetIssue: { issue: null } });

    await expect(getIssue({ id: "MISSING" }, mock)).rejects.toThrow("Issue not found: MISSING");
  });

  it("passes id as variable", async () => {
    const mock = createMockGraphQL({ GetIssue: { issue: rawIssue } });
    await getIssue({ id: "HAT-42" }, mock);
    expect(lastCall(mock).variables).toMatchObject({ id: "HAT-42" });
  });
});
