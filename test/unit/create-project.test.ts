import { describe, it, expect } from "vitest";
import { createProject } from "../../src/tools/create-project.js";
import type { GraphQLFn } from "../../src/graphql.js";
import { createMockGraphQL, lastCall } from "../setup.js";

const successResponse = {
  projectCreate: {
    success: true,
    project: { id: "proj-1", name: "New Project", url: "https://linear.app/hat/project/proj-1" },
  },
};

const milestoneResponse = {
  projectMilestoneCreate: {
    success: true,
    projectMilestone: { id: "ms-1", name: "M" },
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
    expect(result).toEqual({
      id: "proj-1",
      name: "New Project",
      url: "https://linear.app/hat/project/proj-1",
    });
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

    await expect(createProject({ teamId: "bad-team", name: "Fail" }, mock)).rejects.toThrow(
      "projectCreate failed",
    );
  });

  it("throws when projectCreate returns no project data", async () => {
    const mock = createMockGraphQL({
      CreateProject: { projectCreate: { success: true, project: null } },
    });

    await expect(createProject({ teamId: "team-uuid", name: "Empty" }, mock)).rejects.toThrow(
      "projectCreate succeeded but returned no project data",
    );
  });

  it("backward compat: only teamId/name → input has just teamIds+name, no milestone calls", async () => {
    const mock = createMockGraphQL({ CreateProject: successResponse });

    await createProject({ teamId: "team-uuid", name: "Plain" }, mock);

    const createInput = mock.calls[0].variables.input as Record<string, unknown>;
    expect(Object.keys(createInput).sort()).toEqual(["name", "teamIds"]);
    // no CreateMilestone mutation issued
    expect(mock.calls.every((c) => !c.query.includes("CreateMilestone"))).toBe(true);
  });
});

describe("createProject full fields + milestones", () => {
  it("builds input with all provided scalar fields", async () => {
    const mock = createMockGraphQL({
      CreateProject: successResponse,
      CreateMilestone: milestoneResponse,
    });

    await createProject(
      {
        teamId: "team-uuid",
        name: "Full",
        icon: "FaceMonocle",
        color: "#f2994a",
        description: "one-liner",
        content: "# Overview\nbody",
        statusId: "status-uuid",
        leadId: "lead-uuid",
        memberIds: ["m1", "m2"],
        startDate: "2026-07-01",
        targetDate: "2026-09-01",
        priority: 2,
      },
      mock,
    );

    const input = mock.calls[0].variables.input as Record<string, unknown>;
    expect(input).toMatchObject({
      teamIds: ["team-uuid"],
      name: "Full",
      icon: "FaceMonocle",
      color: "#f2994a",
      description: "one-liner",
      content: "# Overview\nbody",
      statusId: "status-uuid",
      leadId: "lead-uuid",
      memberIds: ["m1", "m2"],
      startDate: "2026-07-01",
      targetDate: "2026-09-01",
      priority: 2,
    });
  });

  it("creates milestones in order with sortOrder and projectId", async () => {
    const mock = createMockGraphQL({
      CreateProject: successResponse,
      CreateMilestone: milestoneResponse,
    });

    const result = await createProject(
      {
        teamId: "team-uuid",
        name: "WithMilestones",
        milestones: [
          { name: "M1" },
          { name: "M2", targetDate: "2026-08-01", description: "second" },
        ],
      },
      mock,
    );

    const milestoneCalls = mock.calls.filter((c) => c.query.includes("CreateMilestone"));
    expect(milestoneCalls).toHaveLength(2);

    const in0 = milestoneCalls[0].variables.input as Record<string, unknown>;
    const in1 = milestoneCalls[1].variables.input as Record<string, unknown>;
    expect(in0).toMatchObject({ projectId: "proj-1", name: "M1", sortOrder: 0 });
    expect(in1).toMatchObject({
      projectId: "proj-1",
      name: "M2",
      sortOrder: 1,
      targetDate: "2026-08-01",
      description: "second",
    });

    expect(result.milestones).toEqual([
      { name: "M1", id: "ms-1", status: "created" },
      { name: "M2", id: "ms-1", status: "created" },
    ]);
  });

  it("does not throw when a milestone fails; returns structured status", async () => {
    // Custom graphql: project OK, first milestone OK, second milestone throws.
    let milestoneCount = 0;
    const graphql: GraphQLFn = (async (query: string) => {
      if (query.includes("CreateProject")) return successResponse;
      if (query.includes("CreateMilestone")) {
        milestoneCount += 1;
        if (milestoneCount === 2) throw new Error("milestone boom");
        return milestoneResponse;
      }
      return {};
    }) as GraphQLFn;

    const result = await createProject(
      {
        teamId: "team-uuid",
        name: "PartialFail",
        milestones: [{ name: "ok" }, { name: "bad" }],
      },
      graphql,
    );

    expect(result.id).toBe("proj-1");
    expect(result.milestones?.[0]).toMatchObject({ name: "ok", status: "created" });
    expect(result.milestones?.[1]).toMatchObject({ name: "bad", status: "failed" });
    expect(result.milestones?.[1].error).toContain("milestone boom");
  });
});
