import { describe, it, expect } from "vitest";
import { listTeams } from "../../src/tools/list-teams.js";
import { createMockGraphQL, lastCall } from "../setup.js";

describe("listTeams", () => {
  it("returns list of teams with id and key", async () => {
    const mock = createMockGraphQL({
      ListTeams: {
        teams: {
          nodes: [
            { id: "t1", key: "HAT" },
            { id: "t2", key: "DEV" },
          ],
        },
      },
    });

    const result = await listTeams({}, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("teams");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "t1", key: "HAT" });
    expect(result[1]).toEqual({ id: "t2", key: "DEV" });
  });

  it("returns empty array when no teams found", async () => {
    const mock = createMockGraphQL({ ListTeams: { teams: { nodes: [] } } });
    const result = await listTeams({}, mock);
    expect(result).toEqual([]);
  });

  it("handles missing teams data gracefully", async () => {
    const mock = createMockGraphQL({ ListTeams: {} });
    const result = await listTeams({}, mock);
    expect(result).toEqual([]);
  });
});
