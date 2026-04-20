import { describe, it, expect } from "vitest";
import { createAttachment } from "../../src/tools/create-attachment.js";
import { createMockGraphQL, lastCall } from "../setup.js";

const successResponse = {
  attachmentCreate: {
    success: true,
    attachment: { id: "attach-1", url: "https://example.com/doc.pdf" },
  },
};

describe("createAttachment", () => {
  it("sends issueId and url in input", async () => {
    const mock = createMockGraphQL({ CreateAttachment: successResponse });

    const result = await createAttachment({
      issueId: "issue-uuid",
      url: "https://example.com/doc.pdf",
    }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("CreateAttachment");
    expect(call.query).toContain("$input: AttachmentCreateInput!");
    expect(call.variables.input).toMatchObject({
      issueId: "issue-uuid",
      url: "https://example.com/doc.pdf",
    });
    expect(result).toEqual({ id: "attach-1", url: "https://example.com/doc.pdf" });
  });

  it("includes optional title when provided", async () => {
    const mock = createMockGraphQL({ CreateAttachment: successResponse });

    await createAttachment({
      issueId: "issue-uuid",
      url: "https://example.com/doc.pdf",
      title: "Design Doc",
    }, mock);
    const input = lastCall(mock).variables.input as Record<string, unknown>;

    expect(input.title).toBe("Design Doc");
  });

  it("throws when attachmentCreate returns success=false", async () => {
    const mock = createMockGraphQL({
      CreateAttachment: { attachmentCreate: { success: false, attachment: null } },
    });

    await expect(
      createAttachment({ issueId: "bad", url: "https://x.com" }, mock)
    ).rejects.toThrow("attachmentCreate failed");
  });
});
