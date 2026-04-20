import { describe, it, expect } from "vitest";
import { createProject } from "../../src/tools/create-project.js";
import { createMockGraphQL, lastCall } from "../setup.js";

const successResponse = {
  projectCreate: {
    success: true,
    project: { id: "proj-1", name: "New Project", url: "https://linear.app/hat/project/proj-1" },
  },
};

describe("createProject", () => {
  it("sends teamId and name as teamIds array and name", async () => {
    const mock = createMockGraphQL({ CreateProject: successResponse });

    const result = await createProject({ teamId: "team-uuid", name: "New Project" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("CreateProject");
    expect(call.query).toContain("$input: ProjectCreateInput!");
    const input = call.variables.input as Record<string, unknown>;
    expect(input.teamIds).toEqual(["team-uuid"]);
    expect(input.name).toBe("New Project");
    expect(result).toEqual({ id: "proj-1", name: "New Project", url: "https://linear.app/hat/project/proj-1" });
  });

  it("includes optional icon when provided", async () => {
    const mock = createMockGraphQL({ CreateProject: successResponse });

    await createProject({ teamId: "team-uuid", name: "My Project", icon: "🚀" }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(input.icon).toBe("🚀");
  });

  it("throws when projectCreate returns success=false", async () => {
    const mock = createMockGraphQL({
      CreateProject: { projectCreate: { success: false, project: null } },
    });

    await expect(
      createProject({ teamId: "bad-team", name: "Fail" }, mock)
    ).rejects.toThrow("projectCreate failed");
  });

  it("throws when projectCreate returns no project data", async () => {
    const mock = createMockGraphQL({
      CreateProject: { projectCreate: { success: true, project: null } },
    });

    await expect(
      createProject({ teamId: "team-uuid", name: "Empty" }, mock)
    ).rejects.toThrow("projectCreate succeeded but returned no project data");
  });
});
