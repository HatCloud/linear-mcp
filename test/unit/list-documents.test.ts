import { describe, it, expect } from "vitest";
import { listDocuments } from "../../src/tools/list-documents.js";
import { createMockGraphQL, lastCall } from "../setup.js";

const doc1 = { id: "doc-1", title: "Design Doc", url: "https://linear.app/hat/doc/doc-1", updatedAt: "2026-05-26T00:00:00Z" };

describe("listDocuments", () => {
  it("returns documents for a project", async () => {
    const mock = createMockGraphQL({
      ListDocuments: { project: { documents: { nodes: [doc1] } } },
    });

    const result = await listDocuments({ projectId: "proj-uuid" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("ListDocuments");
    expect(call.variables).toMatchObject({ projectId: "proj-uuid", limit: 25 });
    expect(result).toEqual([doc1]);
  });

  it("uses default limit of 25", async () => {
    const mock = createMockGraphQL({
      ListDocuments: { project: { documents: { nodes: [] } } },
    });

    await listDocuments({ projectId: "proj-uuid" }, mock);

    expect(lastCall(mock).variables.limit).toBe(25);
  });

  it("passes custom limit", async () => {
    const mock = createMockGraphQL({
      ListDocuments: { project: { documents: { nodes: [] } } },
    });

    await listDocuments({ projectId: "proj-uuid", limit: 10 }, mock);

    expect(lastCall(mock).variables.limit).toBe(10);
  });

  it("returns empty array when project has no documents", async () => {
    const mock = createMockGraphQL({
      ListDocuments: { project: { documents: { nodes: [] } } },
    });

    const result = await listDocuments({ projectId: "proj-uuid" }, mock);

    expect(result).toEqual([]);
  });

  it("throws when project is not found", async () => {
    const mock = createMockGraphQL({
      ListDocuments: { project: null },
    });

    await expect(
      listDocuments({ projectId: "nonexistent" }, mock)
    ).rejects.toThrow("Project not found: nonexistent");
  });
});
