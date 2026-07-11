import { describe, it, expect } from "vitest";
import { updateProject } from "../../src/tools/update-project.js";
import { createMockGraphQL, lastCall } from "../setup.js";

const successResponse = {
  projectUpdate: {
    success: true,
    project: {
      id: "proj-1",
      name: "Renamed Project",
      state: "started",
      url: "https://linear.app/hat/project/proj-1",
    },
  },
};

describe("updateProject", () => {
  it("sends id and input with name", async () => {
    const mock = createMockGraphQL({ UpdateProject: successResponse });

    const result = await updateProject({ id: "proj-uuid", name: "Renamed Project" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("UpdateProject");
    expect(call.query).toContain("$id: String!");
    expect(call.query).toContain("$input: ProjectUpdateInput!");
    expect(call.variables).toMatchObject({ id: "proj-uuid" });
    const input = call.variables.input as Record<string, unknown>;
    expect(input.name).toBe("Renamed Project");
    expect(result).toEqual({
      id: "proj-1",
      name: "Renamed Project",
      state: "started",
      url: "https://linear.app/hat/project/proj-1",
    });
  });

  it("sends empty input when no optional fields provided", async () => {
    const mock = createMockGraphQL({ UpdateProject: successResponse });

    await updateProject({ id: "proj-uuid" }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(Object.keys(input)).toHaveLength(0);
  });

  it("throws when projectUpdate returns success=false", async () => {
    const mock = createMockGraphQL({
      UpdateProject: { projectUpdate: { success: false, project: null } },
    });

    await expect(updateProject({ id: "proj-uuid", name: "Fail" }, mock)).rejects.toThrow(
      "projectUpdate failed",
    );
  });

  it("throws when projectUpdate returns no project data", async () => {
    const mock = createMockGraphQL({
      UpdateProject: { projectUpdate: { success: true, project: null } },
    });

    await expect(updateProject({ id: "proj-uuid", name: "Empty" }, mock)).rejects.toThrow(
      "projectUpdate succeeded but returned no project data",
    );
  });

  it("builds input with all provided scalar fields", async () => {
    const mock = createMockGraphQL({ UpdateProject: successResponse });

    await updateProject(
      {
        id: "proj-uuid",
        icon: "FaceMonocle",
        color: "#f2994a",
        description: "summary",
        content: "# body",
        statusId: "status-uuid",
        leadId: "lead-uuid",
        memberIds: ["m1"],
        startDate: "2026-07-01",
        targetDate: "2026-09-01",
        priority: 3,
      },
      mock,
    );

    const input = lastCall(mock).variables.input as Record<string, unknown>;
    expect(input).toMatchObject({
      icon: "FaceMonocle",
      color: "#f2994a",
      description: "summary",
      content: "# body",
      statusId: "status-uuid",
      leadId: "lead-uuid",
      memberIds: ["m1"],
      startDate: "2026-07-01",
      targetDate: "2026-09-01",
      priority: 3,
    });
  });

  it("only includes provided fields (avoids clobbering unset fields)", async () => {
    const mock = createMockGraphQL({ UpdateProject: successResponse });

    await updateProject({ id: "proj-uuid", description: "just this" }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(Object.keys(input)).toEqual(["description"]);
  });
});
