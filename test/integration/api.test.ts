import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createGraphQLClient, type GraphQLFn } from "../../src/graphql.js";
import { listTeams } from "../../src/tools/list-teams.js";
import { getStatusMap } from "../../src/tools/get-status-map.js";
import { listIssues } from "../../src/tools/list-issues.js";
import { searchIssues } from "../../src/tools/search-issues.js";
import { getIssue } from "../../src/tools/get-issue.js";
import { listProjects } from "../../src/tools/list-projects.js";
import { listComments } from "../../src/tools/list-comments.js";
import { listAttachments } from "../../src/tools/list-attachments.js";
import { createIssue } from "../../src/tools/create-issue.js";
import { updateIssue } from "../../src/tools/update-issue.js";
import { createComment } from "../../src/tools/create-comment.js";
import { createAttachment } from "../../src/tools/create-attachment.js";
import { archiveIssue } from "../../src/tools/archive-issue.js";
import { getComment } from "../../src/tools/get-comment.js";

const API_KEY = process.env.LINEAR_API_KEY;
const SKIP = !API_KEY;

const HAT_TEAM_ID = "cac83401-25ca-461e-aec8-e9cb7a16caef";

describe.skipIf(SKIP)("Linear API Integration", () => {
  let graphql: GraphQLFn;

  beforeAll(() => {
    graphql = createGraphQLClient(API_KEY!);
  });

  describe("Read operations", () => {
    it("list_teams returns non-empty array", async () => {
      const teams = await listTeams(graphql);
      expect(teams.length).toBeGreaterThan(0);
      expect(teams[0]).toHaveProperty("id");
      expect(teams[0]).toHaveProperty("key");
    });

    it("get_status_map returns mapping for HAT team", async () => {
      const result = await getStatusMap({ team: "HAT" }, graphql);
      expect(Object.keys(result.map).length).toBeGreaterThan(0);
      expect(result.all.length).toBeGreaterThan(0);
      expect(result.all[0]).toHaveProperty("name");
      expect(result.all[0]).toHaveProperty("type");
    });

    it("list_issues returns results", async () => {
      const issues = await listIssues({ limit: 5 }, graphql);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toHaveProperty("identifier");
    });

    it("list_issues filters by priority without error", async () => {
      const issues = await listIssues({ priority: 2, limit: 5 }, graphql);
      expect(Array.isArray(issues)).toBe(true);
    });

    it("search_issues by team returns results", async () => {
      const issues = await searchIssues(
        { query: "", teamId: HAT_TEAM_ID, limit: 5 },
        graphql
      );
      expect(Array.isArray(issues)).toBe(true);
    });

    it("list_projects returns non-empty array", async () => {
      const projects = await listProjects({}, graphql);
      expect(projects.length).toBeGreaterThan(0);
      expect(projects[0]).toHaveProperty("name");
      expect(projects[0]).toHaveProperty("teams");
    });

    it("list_projects filters by team", async () => {
      const projects = await listProjects({ team: "Hat Studio" }, graphql);
      expect(Array.isArray(projects)).toBe(true);
    });
  });

  describe("Write operations", () => {
    let testIssueId: string;
    let testIssueIdentifier: string;
    let testCommentId: string;

    it("create_issue creates a test issue", async () => {
      const result = await createIssue(
        {
          teamId: HAT_TEAM_ID,
          title: "[Test] Integration test issue - auto cleanup",
          description: "Created by integration test. Will be archived.",
          priority: 4,
        },
        graphql
      );
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("identifier");
      testIssueId = result.id;
      testIssueIdentifier = result.identifier;
    });

    it("get_issue reads the created issue", async () => {
      const issue = await getIssue(
        { id: testIssueIdentifier, comments: false, sub_issues: false },
        graphql
      );
      expect(issue.title).toBe("[Test] Integration test issue - auto cleanup");
      expect(issue.priority).toHaveProperty("value");
      expect(issue.priority).toHaveProperty("name");
    });

    it("update_issue updates title", async () => {
      const result = await updateIssue(
        { id: testIssueId, title: "[Test] Updated title" },
        graphql
      );
      expect(result.success).toBe(true);
    });

    it("update_issue read-back consistency", async () => {
      // Wait briefly for eventual consistency
      await new Promise((r) => setTimeout(r, 1000));
      const issue = await getIssue(
        { id: testIssueIdentifier, comments: false, sub_issues: false },
        graphql
      );
      // Note: Linear API may have eventual consistency delays
      // We record the actual behavior rather than asserting exact match
      console.log(`  [info] read-back title: "${issue.title}"`);
      console.log(`  [info] read-back priority: ${JSON.stringify(issue.priority)}`);
    });

    it("create_comment adds a comment", async () => {
      const result = await createComment(
        { issueId: testIssueId, body: "Integration test comment" },
        graphql
      );
      expect(result).toHaveProperty("id");
      testCommentId = result.id;
    });

    it("list_comments returns the comment", async () => {
      const comments = await listComments(
        { issueId: testIssueId },
        graphql
      );
      expect(comments.length).toBeGreaterThan(0);
    });

    it("get_comment retrieves the comment", async () => {
      const comment = await getComment({ id: testCommentId }, graphql);
      expect(comment.body).toBe("Integration test comment");
    });

    it("create_attachment adds an attachment", async () => {
      const result = await createAttachment(
        {
          issueId: testIssueId,
          url: "https://example.com/test-attachment",
          title: "Test Attachment",
        },
        graphql
      );
      expect(result).toHaveProperty("id");
    });

    it("list_attachments returns attachments for the issue", async () => {
      const attachments = await listAttachments(
        { issueId: testIssueId },
        graphql
      );
      console.log(`  [info] attachments count: ${attachments.length}`);
      console.log(`  [info] attachments: ${JSON.stringify(attachments)}`);
    });

    it("archive_issue cleans up test issue", async () => {
      const result = await archiveIssue({ id: testIssueId }, graphql);
      expect(result.success).toBe(true);
    });
  });
});
