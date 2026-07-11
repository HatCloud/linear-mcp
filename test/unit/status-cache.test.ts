import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDiskStatusCache } from "../../src/status-cache.js";
import type { StatusMapResult } from "../../src/types.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const sample: StatusMapResult = {
  map: { "In Progress": "u1", Done: "u2" },
  all: [
    { id: "u1", name: "In Progress", type: "started" },
    { id: "u2", name: "Done", type: "completed" },
  ],
};

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "status-cache-test-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("createDiskStatusCache", () => {
  it("write then read roundtrips deep-equal", () => {
    const cache = createDiskStatusCache({ dir });
    cache.write("hat", sample);
    expect(cache.read("hat")).toEqual(sample);
  });

  it("read hits across a fresh instance (simulates process restart)", () => {
    const a = createDiskStatusCache({ dir });
    a.write("HAT", sample);
    const b = createDiskStatusCache({ dir });
    expect(b.read("HAT")).toEqual(sample);
  });

  it("normalizes keys (trim + lowercase) to the same entry", () => {
    const cache = createDiskStatusCache({ dir });
    cache.write("  HAT ", sample);
    expect(cache.read("hat")).toEqual(sample);
  });

  it("invalidate clears all entries", () => {
    const cache = createDiskStatusCache({ dir });
    cache.write("hat", sample);
    cache.invalidate();
    expect(cache.read("hat")).toBeNull();
  });

  it("read returns null for missing key", () => {
    const cache = createDiskStatusCache({ dir });
    expect(cache.read("nope")).toBeNull();
  });

  it("read returns null (no throw) on corrupt JSON file", () => {
    const cache = createDiskStatusCache({ dir });
    cache.write("hat", sample);
    // Corrupt every cache file on disk.
    for (const f of fs.readdirSync(dir)) {
      fs.writeFileSync(path.join(dir, f), "{ not json");
    }
    expect(() => cache.read("hat")).not.toThrow();
    expect(cache.read("hat")).toBeNull();
  });

  it("does not carry a path-traversal key outside the cache dir", () => {
    const cache = createDiskStatusCache({ dir });
    cache.write("../../evil", sample);
    // Every file created must live inside `dir` (hashed filename, no traversal).
    const files = fs.readdirSync(dir);
    expect(files.length).toBe(1);
    expect(cache.read("../../evil")).toEqual(sample);
  });

  it("write does not throw when the target dir is unwritable", () => {
    const roDir = fs.mkdtempSync(path.join(os.tmpdir(), "status-cache-ro-"));
    fs.chmodSync(roDir, 0o500); // read+execute only, no write
    const cache = createDiskStatusCache({ dir: roDir });
    expect(() => cache.write("hat", sample)).not.toThrow();
    fs.chmodSync(roDir, 0o700);
    fs.rmSync(roDir, { recursive: true, force: true });
  });
});
