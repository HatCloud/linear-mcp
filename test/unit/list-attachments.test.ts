import { describe, it, expect } from "vitest";
import { listAttachments } from "../../src/tools/list-attachments.js";
import { createMockGraphQL, lastCall } from "../setup.js";

describe("listAttachments", () => {
  it("passes issueId and returns attachment list", async () => {
    const mock = createMockGraphQL({
      ListAttachments: {
        issue: {
          attachments: {
            nodes: [
              { id: "a1", url: "https://example.com/file.pdf", title: "Design Doc", createdAt: "2024-01-01T00:00:00Z" },
            ],
          },
        },
      },
    });

    const result = await listAttachments({ issueId: "issue-uuid-123" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("issue(id: $issueId)");
    expect(call.variables).toMatchObject({ issueId: "issue-uuid-123" });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "a1",
      url: "https://example.com/file.pdf",
      title: "Design Doc",
      createdAt: "2024-01-01T00:00:00Z",
    });
  });

  it("returns empty array when issue has no attachments", async () => {
    const mock = createMockGraphQL({
      ListAttachments: { issue: { attachments: { nodes: [] } } },
    });

    const result = await listAttachments({ issueId: "no-attachments" }, mock);
    expect(result).toEqual([]);
  });

  it("handles missing issue gracefully", async () => {
    const mock = createMockGraphQL({ ListAttachments: { issue: null } });
    const result = await listAttachments({ issueId: "missing" }, mock);
    expect(result).toEqual([]);
  });

  it("clamps limit to max 50", async () => {
    const mock = createMockGraphQL({ ListAttachments: { issue: { attachments: { nodes: [] } } } });
    await listAttachments({ issueId: "x", limit: 100 }, mock);
    expect(lastCall(mock).variables).toMatchObject({ limit: 50 });
  });
});
