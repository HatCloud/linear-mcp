import { describe, it, expect } from "vitest";
import { listProjects } from "../../src/tools/list-projects.js";
import { createMockGraphQL, lastCall } from "../setup.js";

describe("listProjects", () => {
  it("uses accessibleTeams filter when team is specified", async () => {
    const mock = createMockGraphQL({
      ListProjectsByTeam: {
        projects: {
          nodes: [
            { id: "p1", name: "Project Alpha", state: "started", teams: { nodes: [{ id: "t1", key: "HAT" }] } },
          ],
        },
      },
    });

    const result = await listProjects({ team: "Hat Studio" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("accessibleTeams");
    expect(call.query).toContain("$teamName: String!");
    expect(call.variables).toMatchObject({ teamName: "Hat Studio" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Project Alpha");
    expect(result[0].teams).toEqual([{ id: "t1", key: "HAT" }]);
  });

  it("fetches all projects without filter when no team specified", async () => {
    const mock = createMockGraphQL({
      ListProjects: {
        projects: {
          nodes: [
            { id: "p1", name: "Alpha", state: "started", teams: { nodes: [{ id: "t1", key: "HAT" }] } },
            { id: "p2", name: "Beta", state: "paused", teams: { nodes: [] } },
          ],
        },
      },
    });

    const result = await listProjects({}, mock);
    const call = lastCall(mock);

    expect(call.query).not.toContain("accessibleTeams");
    expect(call.variables).toMatchObject({ limit: 25 });
    expect(result).toHaveLength(2);
    expect(result[1].teams).toEqual([]);
  });

  it("flattens teams.nodes into teams array", async () => {
    const mock = createMockGraphQL({
      ListProjects: {
        projects: {
          nodes: [
            {
              id: "p1",
              name: "Multi-team Project",
              state: "started",
              teams: { nodes: [{ id: "t1", key: "HAT" }, { id: "t2", key: "DEV" }] },
            },
          ],
        },
      },
    });

    const result = await listProjects({}, mock);

    expect(result[0].teams).toEqual([
      { id: "t1", key: "HAT" },
      { id: "t2", key: "DEV" },
    ]);
  });

  it("returns empty array when no projects found", async () => {
    const mock = createMockGraphQL({ ListProjects: { projects: { nodes: [] } } });
    const result = await listProjects({}, mock);
    expect(result).toEqual([]);
  });

  it("clamps limit to max 50", async () => {
    const mock = createMockGraphQL({ ListProjects: { projects: { nodes: [] } } });
    await listProjects({ limit: 100 }, mock);
    expect(lastCall(mock).variables).toMatchObject({ limit: 50 });
  });
});
