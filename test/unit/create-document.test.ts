import { describe, it, expect } from "vitest";
import { createDocument } from "../../src/tools/create-document.js";
import { createMockGraphQL, lastCall, nthCall } from "../setup.js";

const successResponse = {
  documentCreate: {
    success: true,
    document: { id: "doc-1", url: "https://linear.app/hat/document/doc-1" },
  },
};

describe("createDocument", () => {
  it("creates document with projectId directly", async () => {
    const mock = createMockGraphQL({ DocumentCreate: successResponse });

    const result = await createDocument({
      title: "Design Doc",
      content: "# Overview",
      projectId: "proj-uuid",
    }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("DocumentCreate");
    expect(call.query).toContain("$input: DocumentCreateInput!");
    expect(call.variables.input).toMatchObject({
      title: "Design Doc",
      projectId: "proj-uuid",
    });
    expect(result).toEqual({ id: "doc-1", url: "https://linear.app/hat/document/doc-1" });
  });

  it("resolves identifier to UUID before creating document with issueId", async () => {
    const mock = createMockGraphQL({
      ResolveIssue: { issue: { id: "resolved-uuid" } },
      DocumentCreate: successResponse,
    });

    await createDocument({
      title: "Issue Doc",
      content: "Details",
      issueId: "HAT-155",
    }, mock);

    const resolveCall = nthCall(mock, 0);
    const createCall = nthCall(mock, 1);

    expect(resolveCall.query).toContain("ResolveIssue");
    expect(resolveCall.variables).toMatchObject({ id: "HAT-155" });
    const createInput = createCall.variables.input as Record<string, unknown>;
    expect(createInput.issueId).toBe("resolved-uuid");
  });

  it("uses UUID issueId directly without resolving", async () => {
    const issueUUID = "1de25fc9-1234-5678-abcd-ef0123456789";
    const mock = createMockGraphQL({ DocumentCreate: successResponse });

    await createDocument({
      title: "Doc",
      content: "Content",
      issueId: issueUUID,
    }, mock);

    // Only one call — no resolve needed
    expect(mock.calls).toHaveLength(1);
    const input = lastCall(mock).variables.input as Record<string, unknown>;
    expect(input.issueId).toBe(issueUUID);
  });

  it("normalizes \\\\n in content", async () => {
    const mock = createMockGraphQL({ DocumentCreate: successResponse });

    await createDocument({
      title: "Doc",
      content: "Line1\\nLine2",
      projectId: "proj-uuid",
    }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(input.content).toBe("Line1\nLine2");
  });

  it("throws when neither projectId nor issueId provided", async () => {
    const mock = createMockGraphQL({ DocumentCreate: successResponse });

    await expect(
      createDocument({ title: "Doc", content: "Content" }, mock)
    ).rejects.toThrow("Either projectId or issueId must be provided");
  });

  it("throws when documentCreate returns success=false", async () => {
    const mock = createMockGraphQL({
      DocumentCreate: { documentCreate: { success: false, document: null } },
    });

    await expect(
      createDocument({ title: "Doc", content: "x", projectId: "p" }, mock)
    ).rejects.toThrow("documentCreate failed");
  });

  it("throws when identifier cannot be resolved", async () => {
    const mock = createMockGraphQL({
      ResolveIssue: { issue: null },
      DocumentCreate: successResponse,
    });

    await expect(
      createDocument({ title: "Doc", content: "x", issueId: "HAT-999" }, mock)
    ).rejects.toThrow("Could not resolve issue identifier: HAT-999");
  });
});
