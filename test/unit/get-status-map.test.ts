import { describe, it, expect } from "vitest";
import { getStatusMap } from "../../src/tools/get-status-map.js";
import { createMockGraphQL, nthCall } from "../setup.js";

const workflowStates = [
  { id: "state-backlog", name: "Backlog", type: "backlog" },
  { id: "state-progress", name: "In Progress", type: "started" },
  { id: "state-done", name: "Done", type: "completed" },
];

describe("getStatusMap", () => {
  it("resolves team key to UUID via teams query", async () => {
    const mock = createMockGraphQL({
      teams: { teams: { nodes: [{ id: "team-uuid", key: "HAT" }] } },
      GetStatuses: { workflowStates: { nodes: workflowStates } },
    });

    const result = await getStatusMap({ team: "HAT" }, mock);

    const teamsCall = nthCall(mock, 0);
    const statusCall = nthCall(mock, 1);

    expect(teamsCall.query).toContain("teams");
    expect(statusCall.query).toContain("workflowStates");
    expect(statusCall.variables).toMatchObject({ teamId: "team-uuid" });

    expect(result.map["In Progress"]).toBe("state-progress");
    expect(result.map["Done"]).toBe("state-done");
  });

  it("uses team input directly when it looks like a UUID", async () => {
    const teamUUID = "cac83401-25ca-461e-aec8-e9cb7a16caef";
    const mock = createMockGraphQL({
      GetStatuses: { workflowStates: { nodes: workflowStates } },
    });

    await getStatusMap({ team: teamUUID }, mock);

    // Only one call (no team resolution needed)
    expect(mock.calls).toHaveLength(1);
    const call = mock.calls[0];
    expect(call.variables).toMatchObject({ teamId: teamUUID });
  });

  it("returns both map and all fields", async () => {
    const mock = createMockGraphQL({
      GetStatuses: { workflowStates: { nodes: workflowStates } },
    });

    const result = await getStatusMap({ team: "cac83401-25ca-461e-aec8-e9cb7a16caef" }, mock);

    expect(result.map).toBeTypeOf("object");
    expect(result.all).toEqual(workflowStates);
    expect(Object.keys(result.map)).toHaveLength(3);
  });

  it("throws when team key not found", async () => {
    const mock = createMockGraphQL({
      teams: { teams: { nodes: [{ id: "t1", key: "DEV" }] } },
      GetStatuses: { workflowStates: { nodes: [] } },
    });

    await expect(getStatusMap({ team: "UNKNOWN" }, mock)).rejects.toThrow(
      'Team key "UNKNOWN" not found'
    );
  });

  it("throws when no workflow states found", async () => {
    const mock = createMockGraphQL({
      GetStatuses: { workflowStates: { nodes: [] } },
    });

    await expect(
      getStatusMap({ team: "cac83401-25ca-461e-aec8-e9cb7a16caef" }, mock)
    ).rejects.toThrow("No workflow states found");
  });

  it("does case-insensitive team key matching", async () => {
    const mock = createMockGraphQL({
      teams: { teams: { nodes: [{ id: "team-uuid", key: "HAT" }] } },
      GetStatuses: { workflowStates: { nodes: workflowStates } },
    });

    const result = await getStatusMap({ team: "hat" }, mock);
    expect(result.all).toHaveLength(3);
  });
});
