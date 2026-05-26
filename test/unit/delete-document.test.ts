import { describe, it, expect } from "vitest";
import { deleteDocument } from "../../src/tools/delete-document.js";
import { createMockGraphQL, lastCall } from "../setup.js";

describe("deleteDocument", () => {
  it("deletes a document successfully", async () => {
    const mock = createMockGraphQL({
      DeleteDocument: { documentDelete: { success: true } },
    });

    const result = await deleteDocument({ id: "doc-1" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("DeleteDocument");
    expect(call.variables).toMatchObject({ id: "doc-1" });
    expect(result).toEqual({ success: true });
  });

  it("throws when documentDelete returns success=false", async () => {
    const mock = createMockGraphQL({
      DeleteDocument: { documentDelete: { success: false } },
    });

    await expect(
      deleteDocument({ id: "doc-1" }, mock)
    ).rejects.toThrow("documentDelete failed for document: doc-1");
  });

  it("throws when documentDelete returns null", async () => {
    const mock = createMockGraphQL({
      DeleteDocument: { documentDelete: null },
    });

    await expect(
      deleteDocument({ id: "doc-1" }, mock)
    ).rejects.toThrow("documentDelete failed");
  });
});
