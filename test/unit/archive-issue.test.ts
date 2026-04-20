import { describe, it, expect } from "vitest";
import { archiveIssue } from "../../src/tools/archive-issue.js";
import { createMockGraphQL, lastCall } from "../setup.js";

describe("archiveIssue", () => {
  it("sends id and returns success", async () => {
    const mock = createMockGraphQL({
      ArchiveIssue: { issueArchive: { success: true } },
    });

    const result = await archiveIssue({ id: "issue-uuid" }, mock);
    const call = lastCall(mock);

    expect(call.query).toContain("ArchiveIssue");
    expect(call.query).toContain("$id: String!");
    expect(call.variables).toMatchObject({ id: "issue-uuid" });
    expect(result).toEqual({ success: true });
  });

  it("throws when issueArchive returns success=false", async () => {
    const mock = createMockGraphQL({
      ArchiveIssue: { issueArchive: { success: false } },
    });

    await expect(archiveIssue({ id: "bad-id" }, mock)).rejects.toThrow(
      "issueArchive failed"
    );
  });

  it("throws when issueArchive response is missing", async () => {
    const mock = createMockGraphQL({ ArchiveIssue: {} });

    await expect(archiveIssue({ id: "bad-id" }, mock)).rejects.toThrow(
      "issueArchive failed"
    );
  });
});
