import { describe, it, expect } from "vitest";
import { searchIssues } from "../../src/tools/search-issues.js";
import { createMockGraphQL, lastCall, nthCall } from "../setup.js";

const rawNode = {
  id: "issue-1",
  identifier: "HAT-1",
  title: "Login fix",
  priority: 1,
  priorityLabel: "Urgent",
  state: { name: "In Progress", type: "started" },
  assignee: { displayName: "Alice" },
  parent: null,
};

describe("searchIssues", () => {
  it("uses containsIgnoreCase title filter", async () => {
    const mock = createMockGraphQL({ SearchIssues: { issues: { nodes: [rawNode] } } });

    const result = await searchIssues({ query: "login" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("title: { containsIgnoreCase: $query }");
    expect(call.variables).toMatchObject({ query: "login" });
    expect(result).toHaveLength(1);
  });

  it("transforms response correctly", async () => {
    const mock = createMockGraphQL({ SearchIssues: { issues: { nodes: [rawNode] } } });

    const result = await searchIssues({ query: "login" }, mock);

    expect(result[0]).toMatchObject({
      id: "issue-1",
      identifier: "HAT-1",
      title: "Login fix",
      priority: { value: 1, name: "Urgent" },
      state: { name: "In Progress", type: "started" },
      assignee: "Alice",
      parentId: null,
    });
  });

  it("adds team filter when team is specified", async () => {
    const mock = createMockGraphQL({ SearchIssues: { issues: { nodes: [] } } });

    await searchIssues({ query: "bug", team: "team-uuid" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("team: { id: { eq: $teamId } }");
    expect(call.variables).toMatchObject({ teamId: "team-uuid" });
  });

  it("resolves 'me' assignee via viewer query", async () => {
    const mock = createMockGraphQL({
      viewer: { viewer: { id: "me-uuid" } },
      SearchIssues: { issues: { nodes: [] } },
    });

    await searchIssues({ query: "task", assignee: "me" }, mock);

    const viewerCall = nthCall(mock, 0);
    const searchCall = nthCall(mock, 1);

    expect(viewerCall.query).toContain("viewer");
    expect(searchCall.query).toContain("assignee: { id: { eq: $assigneeId } }");
    expect(searchCall.variables).toMatchObject({ assigneeId: "me-uuid" });
  });

  it("adds state filter when state is specified", async () => {
    const mock = createMockGraphQL({ SearchIssues: { issues: { nodes: [] } } });

    await searchIssues({ query: "task", state: "Done" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("state: { name: { eq: $stateName } }");
    expect(call.variables).toMatchObject({ stateName: "Done" });
  });

  it("returns empty array when no results", async () => {
    const mock = createMockGraphQL({ SearchIssues: { issues: { nodes: [] } } });
    const result = await searchIssues({ query: "nonexistent" }, mock);
    expect(result).toEqual([]);
  });

  it("clamps limit to 50", async () => {
    const mock = createMockGraphQL({ SearchIssues: { issues: { nodes: [] } } });
    await searchIssues({ query: "test", limit: 999 }, mock);
    expect(lastCall(mock).variables).toMatchObject({ limit: 50 });
  });
});
