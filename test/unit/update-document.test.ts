import { describe, it, expect } from "vitest";
import { updateDocument } from "../../src/tools/update-document.js";
import { createMockGraphQL, lastCall } from "../setup.js";

const successResponse = {
  documentUpdate: {
    success: true,
    document: { id: "doc-1", title: "New Title", url: "https://linear.app/hat/doc/doc-1" },
  },
};

describe("updateDocument", () => {
  it("updates document title", async () => {
    const mock = createMockGraphQL({ UpdateDocument: successResponse });

    const result = await updateDocument({ id: "doc-1", title: "New Title" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("UpdateDocument");
    expect(call.variables).toMatchObject({ id: "doc-1" });
    expect((call.variables.input as Record<string, unknown>).title).toBe("New Title");
    expect(result).toEqual({ id: "doc-1", title: "New Title", url: "https://linear.app/hat/doc/doc-1" });
  });

  it("normalizes \\\\n in content", async () => {
    const mock = createMockGraphQL({ UpdateDocument: successResponse });

    await updateDocument({ id: "doc-1", content: "Line1\\nLine2" }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(input.content).toBe("Line1\nLine2");
  });

  it("omits content from input when not provided", async () => {
    const mock = createMockGraphQL({ UpdateDocument: successResponse });

    await updateDocument({ id: "doc-1", title: "Only Title" }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(input.title).toBe("Only Title");
    expect(input.content).toBeUndefined();
  });

  it("omits title from input when not provided", async () => {
    const mock = createMockGraphQL({ UpdateDocument: successResponse });

    await updateDocument({ id: "doc-1", content: "New content" }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(input.title).toBeUndefined();
    expect(input.content).toBe("New content");
  });

  it("throws when documentUpdate returns success=false", async () => {
    const mock = createMockGraphQL({
      UpdateDocument: { documentUpdate: { success: false, document: null } },
    });

    await expect(
      updateDocument({ id: "doc-1", title: "x" }, mock)
    ).rejects.toThrow("documentUpdate failed for document: doc-1");
  });

  it("throws when documentUpdate returns no document", async () => {
    const mock = createMockGraphQL({
      UpdateDocument: { documentUpdate: { success: true, document: null } },
    });

    await expect(
      updateDocument({ id: "doc-1", title: "x" }, mock)
    ).rejects.toThrow("documentUpdate succeeded but returned no document data");
  });
});
