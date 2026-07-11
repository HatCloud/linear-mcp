import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getStatusMap } from "../../src/tools/get-status-map.js";
import { createDiskStatusCache } from "../../src/status-cache.js";
import type { StatusCache } from "../../src/status-cache.js";
import type { StatusMapResult } from "../../src/types.js";
import { createMockGraphQL, nthCall } from "../setup.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const workflowStates = [
  { id: "state-backlog", name: "Backlog", type: "backlog" },
  { id: "state-progress", name: "In Progress", type: "started" },
  { id: "state-done", name: "Done", type: "completed" },
];

// 内存 cache：让每个测试拿到隔离的、可断言的缓存，不落磁盘、不跨测试串扰。
function memCache(): StatusCache {
  const store = new Map<string, StatusMapResult>();
  const norm = (k: string) => k.trim().toLowerCase();
  return {
    read: (k) => store.get(norm(k)) ?? null,
    write: (k, v) => {
      store.set(norm(k), v);
    },
    invalidate: () => store.clear(),
  };
}

let cache: StatusCache;
beforeEach(() => {
  cache = memCache();
});

describe("getStatusMap", () => {
  it("resolves team key to UUID via teams query", async () => {
    const mock = createMockGraphQL({
      teams: { teams: { nodes: [{ id: "team-uuid", key: "HAT" }] } },
      GetStatuses: { workflowStates: { nodes: workflowStates } },
    });

    const result = await getStatusMap({ team: "HAT" }, mock, cache);

    const teamsCall = nthCall(mock, 0);
    const statusCall = nthCall(mock, 1);

    expect(teamsCall.query).toContain("teams");
    expect(statusCall.query).toContain("workflowStates");
    expect(statusCall.variables).toMatchObject({ teamId: "team-uuid" });

    expect(result.map["In Progress"]).toBe("state-progress");
    expect(result.map["Done"]).toBe("state-done");
  });

  it("uses team input directly when it looks like a UUID", async () => {
    const teamUUID = "cac83401-25ca-461e-aec8-e9cb7a16caef";
    const mock = createMockGraphQL({
      GetStatuses: { workflowStates: { nodes: workflowStates } },
    });

    await getStatusMap({ team: teamUUID }, mock, cache);

    // Only one call (no team resolution needed)
    expect(mock.calls).toHaveLength(1);
    const call = mock.calls[0];
    expect(call.variables).toMatchObject({ teamId: teamUUID });
  });

  it("returns both map and all fields", async () => {
    const mock = createMockGraphQL({
      GetStatuses: { workflowStates: { nodes: workflowStates } },
    });

    const result = await getStatusMap(
      { team: "cac83401-25ca-461e-aec8-e9cb7a16caef" },
      mock,
      cache,
    );

    expect(result.map).toBeTypeOf("object");
    expect(result.all).toEqual(workflowStates);
    expect(Object.keys(result.map)).toHaveLength(3);
  });

  it("throws when team key not found", async () => {
    const mock = createMockGraphQL({
      teams: { teams: { nodes: [{ id: "t1", key: "DEV" }] } },
      GetStatuses: { workflowStates: { nodes: [] } },
    });

    await expect(getStatusMap({ team: "UNKNOWN" }, mock, cache)).rejects.toThrow(
      'Team key "UNKNOWN" not found',
    );
  });

  it("throws when no workflow states found", async () => {
    const mock = createMockGraphQL({
      GetStatuses: { workflowStates: { nodes: [] } },
    });

    await expect(
      getStatusMap({ team: "cac83401-25ca-461e-aec8-e9cb7a16caef" }, mock, cache),
    ).rejects.toThrow("No workflow states found");
  });

  it("does case-insensitive team key matching", async () => {
    const mock = createMockGraphQL({
      teams: { teams: { nodes: [{ id: "team-uuid", key: "HAT" }] } },
      GetStatuses: { workflowStates: { nodes: workflowStates } },
    });

    const result = await getStatusMap({ team: "hat" }, mock, cache);
    expect(result.all).toHaveLength(3);
  });
});

describe("getStatusMap caching", () => {
  const cached: StatusMapResult = {
    map: { "In Progress": "u1" },
    all: [{ id: "u1", name: "In Progress", type: "started" }],
  };

  it("(a) returns cache hit without calling graphql", async () => {
    cache.write("hat", cached);
    const mock = createMockGraphQL({}); // any call → empty; assert none happen
    const result = await getStatusMap({ team: "hat" }, mock, cache);
    expect(result).toEqual(cached);
    expect(mock.calls).toHaveLength(0);
  });

  it("(b) refresh:true bypasses cache and refetches, updating cache", async () => {
    cache.write("cac83401-25ca-461e-aec8-e9cb7a16caef", cached);
    const mock = createMockGraphQL({
      GetStatuses: { workflowStates: { nodes: workflowStates } },
    });
    const result = await getStatusMap(
      { team: "cac83401-25ca-461e-aec8-e9cb7a16caef", refresh: true },
      mock,
      cache,
    );
    expect(mock.calls.length).toBeGreaterThan(0);
    expect(result.all).toEqual(workflowStates);
    // cache updated with fresh result
    expect(cache.read("cac83401-25ca-461e-aec8-e9cb7a16caef")?.all).toEqual(workflowStates);
  });

  it("(c) expect-miss (status not in cached map) triggers refetch", async () => {
    cache.write("cac83401-25ca-461e-aec8-e9cb7a16caef", cached); // no "Done"
    const mock = createMockGraphQL({
      GetStatuses: { workflowStates: { nodes: workflowStates } },
    });
    const result = await getStatusMap(
      { team: "cac83401-25ca-461e-aec8-e9cb7a16caef", expect: "Done" },
      mock,
      cache,
    );
    expect(mock.calls.length).toBeGreaterThan(0);
    expect(result.map["Done"]).toBe("state-done");
  });

  it("(c2) expect present in cache still hits without network", async () => {
    cache.write("hat", cached);
    const mock = createMockGraphQL({});
    const result = await getStatusMap({ team: "hat", expect: "In Progress" }, mock, cache);
    expect(result).toEqual(cached);
    expect(mock.calls).toHaveLength(0);
  });

  it("(d) miss fetches and writes result into cache", async () => {
    const mock = createMockGraphQL({
      GetStatuses: { workflowStates: { nodes: workflowStates } },
    });
    expect(cache.read("cac83401-25ca-461e-aec8-e9cb7a16caef")).toBeNull();
    await getStatusMap({ team: "cac83401-25ca-461e-aec8-e9cb7a16caef" }, mock, cache);
    expect(cache.read("cac83401-25ca-461e-aec8-e9cb7a16caef")?.all).toEqual(workflowStates);
  });
});

describe("getStatusMap disk cache (process-restart equivalence, M8)", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "gsm-disk-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("second cache instance (same dir) hits without network", async () => {
    const cacheA = createDiskStatusCache({ dir });
    const mockA = createMockGraphQL({
      GetStatuses: { workflowStates: { nodes: workflowStates } },
    });
    await getStatusMap({ team: "cac83401-25ca-461e-aec8-e9cb7a16caef" }, mockA, cacheA);
    expect(mockA.calls.length).toBe(1); // miss → 1 fetch

    // Fresh instance = simulates process restart reading the persisted file.
    const cacheB = createDiskStatusCache({ dir });
    const mockB = createMockGraphQL({});
    const result = await getStatusMap(
      { team: "cac83401-25ca-461e-aec8-e9cb7a16caef" },
      mockB,
      cacheB,
    );
    expect(result.all).toEqual(workflowStates);
    expect(mockB.calls).toHaveLength(0); // hit from disk, no network
  });

  it("(e) works without an explicit cache arg (default diskStatusCache)", async () => {
    // Hermetic: point the default cache dir at a temp XDG_CACHE_HOME and load a
    // fresh module graph so the diskStatusCache singleton is constructed against
    // it (avoids polluting the real ~/.cache).
    vi.stubEnv("XDG_CACHE_HOME", dir);
    vi.resetModules();
    const { getStatusMap: freshGetStatusMap } = await import("../../src/tools/get-status-map.js");
    const mock = createMockGraphQL({
      GetStatuses: { workflowStates: { nodes: workflowStates } },
    });

    // No third argument → exercises the `cache = diskStatusCache` default param.
    const result = await freshGetStatusMap({ team: "cac83401-25ca-461e-aec8-e9cb7a16caef" }, mock);
    expect(result.all).toEqual(workflowStates);

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
