import { describe, it, expect } from "vitest";
import { listIssues } from "../../src/tools/list-issues.js";
import { createMockGraphQL, lastCall, nthCall } from "../setup.js";

const rawNode = {
  id: "issue-1",
  identifier: "HAT-1",
  title: "Fix bug",
  priority: 2,
  priorityLabel: "High",
  state: { name: "In Progress", type: "started" },
  assignee: { displayName: "Alice" },
  parent: null,
};

describe("listIssues", () => {
  it("transforms response: merges priority fields, flattens parent", async () => {
    const mock = createMockGraphQL({
      ListIssues: { issues: { nodes: [rawNode] } },
    });

    const result = await listIssues({}, mock);

    expect(result[0]).toEqual({
      id: "issue-1",
      identifier: "HAT-1",
      title: "Fix bug",
      priority: { value: 2, name: "High" },
      state: { name: "In Progress", type: "started" },
      assignee: "Alice",
      parentId: null,
    });
  });

  it("uses $priority: Float! variable type for priority filter", async () => {
    const mock = createMockGraphQL({ ListIssues: { issues: { nodes: [] } } });
    await listIssues({ priority: 1 }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("$priority: Float!");
    expect(call.variables).toMatchObject({ priority: 1 });
  });

  it("uses type filter for known state types", async () => {
    const mock = createMockGraphQL({ ListIssues: { issues: { nodes: [] } } });
    await listIssues({ state: "started" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("state: { type: { eq: $stateType } }");
    expect(call.variables).toMatchObject({ stateType: "started" });
  });

  it("uses name filter for custom state names", async () => {
    const mock = createMockGraphQL({ ListIssues: { issues: { nodes: [] } } });
    await listIssues({ state: "In Progress" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("state: { name: { eq: $stateName } }");
    expect(call.variables).toMatchObject({ stateName: "In Progress" });
  });

  it("resolves 'me' assignee via viewer query", async () => {
    const mock = createMockGraphQL({
      viewer: { viewer: { id: "user-uuid-me" } },
      ListIssues: { issues: { nodes: [] } },
    });

    await listIssues({ assignee: "me" }, mock);

    const viewerCall = nthCall(mock, 0);
    const issuesCall = nthCall(mock, 1);
    expect(viewerCall.query).toContain("viewer");
    expect(issuesCall.query).toContain("assignee: { id: { eq: $assigneeId } }");
    expect(issuesCall.variables).toMatchObject({ assigneeId: "user-uuid-me" });
  });

  it("uses assignee null filter for 'null' string", async () => {
    const mock = createMockGraphQL({ ListIssues: { issues: { nodes: [] } } });
    await listIssues({ assignee: "null" }, mock);
    const call = lastCall(mock);
    expect(call.query).toContain("assignee: { null: true }");
  });

  it("adds title containsIgnoreCase filter for query param", async () => {
    const mock = createMockGraphQL({ ListIssues: { issues: { nodes: [] } } });
    await listIssues({ query: "login" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("title: { containsIgnoreCase: $queryStr }");
    expect(call.variables).toMatchObject({ queryStr: "login" });
  });

  it("clamps limit to 50", async () => {
    const mock = createMockGraphQL({ ListIssues: { issues: { nodes: [] } } });
    await listIssues({ limit: 999 }, mock);
    expect(lastCall(mock).variables).toMatchObject({ limit: 50 });
  });

  it("returns empty array when no issues", async () => {
    const mock = createMockGraphQL({ ListIssues: { issues: { nodes: [] } } });
    const result = await listIssues({}, mock);
    expect(result).toEqual([]);
  });

  it("sets parentId from parent.id", async () => {
    const nodeWithParent = { ...rawNode, parent: { id: "parent-uuid" } };
    const mock = createMockGraphQL({ ListIssues: { issues: { nodes: [nodeWithParent] } } });
    const result = await listIssues({}, mock);
    expect(result[0].parentId).toBe("parent-uuid");
  });
});
