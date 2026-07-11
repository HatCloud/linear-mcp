// src/status-cache.ts
//
// get_status_map 的本地磁盘缓存。
//
// 为什么要缓存？workflowStates 是团队级、几乎不变的数据，但每次 get_status_map
// 都实时查一次 GraphQL。把结果持久化到磁盘后，正常情况直接命中缓存，只有在失效
// 场景（目标 status 不在缓存 / 提交出错 / 显式 refresh）才回源，省掉重复网络往返。
//
// 设计要点：
// - 按 team 输入的原始字符串（归一化后）分键——命中时无需先做 key→UUID 的网络解析。
// - 目录按 LINEAR_API_KEY 的短哈希命名空间隔离，避免多 workspace 串键。
// - 文件名用 key 的哈希（而非原始字符串），防止 team 参数含路径穿越字符写到目录外。
// - 原子写（write-temp-then-rename），避免并发写产生截断/交错的坏 JSON。
// - 所有 FS 操作容错：读失败视为 miss、写/失效失败静默——缓存故障绝不破坏 get_status_map。
// - 不做 TTL：正常一律用缓存，失效只由三类触发驱动（见 get-status-map.ts）。

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import type { StatusMapResult } from "./types.js";

export interface StatusCache {
  read(key: string): StatusMapResult | null;
  write(key: string, value: StatusMapResult): void;
  invalidate(): void; // 清空全部（当前无按 key 精确失效的调用方，YAGNI）
}

interface CacheFile {
  cachedAt: string;
  team: string;
  result: StatusMapResult;
}

const normalize = (key: string): string => key.trim().toLowerCase();

const sha256 = (input: string): string => crypto.createHash("sha256").update(input).digest("hex");

// LINEAR_API_KEY 的短哈希，作为缓存目录命名空间——不同 workspace 的缓存彼此隔离。
function apiKeyNamespace(): string {
  const key = process.env.LINEAR_API_KEY;
  return key ? sha256(key).slice(0, 8) : "default";
}

function defaultCacheDir(): string {
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(base, "linear-mcp", apiKeyNamespace(), "status-map");
}

export function createDiskStatusCache(opts: { dir?: string } = {}): StatusCache {
  const cacheDir = opts.dir ?? defaultCacheDir();

  // key → 文件名：对归一化后的 key 取哈希，杜绝原始字符串直接作为路径片段（路径穿越防护）。
  const keyToFile = (key: string): string =>
    path.join(cacheDir, `${sha256(normalize(key)).slice(0, 16)}.json`);

  return {
    read(key: string): StatusMapResult | null {
      try {
        const raw = fs.readFileSync(keyToFile(key), "utf-8");
        const parsed = JSON.parse(raw) as CacheFile;
        return parsed.result ?? null;
      } catch {
        // 文件不存在 / JSON 损坏 / 权限问题 → 视为 miss，降级为直连网络。
        return null;
      }
    },

    write(key: string, value: StatusMapResult): void {
      try {
        fs.mkdirSync(cacheDir, { recursive: true });
        const body: CacheFile = {
          cachedAt: new Date().toISOString(),
          team: normalize(key),
          result: value,
        };
        const finalPath = keyToFile(key);
        // 原子写：先写同目录临时文件，再 rename（rename 在同一文件系统内是原子操作）。
        const tmpPath = `${finalPath}.${process.pid}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(body));
        fs.renameSync(tmpPath, finalPath);
      } catch {
        // 写失败静默——缓存是优化，不是正确性依赖。
      }
    },

    invalidate(): void {
      try {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      } catch {
        // 失效失败静默——下次提交仍会失败并再次触发失效，最终收敛。
      }
    },
  };
}

// 默认单例：get-status-map / update-issue 缺省使用；测试注入临时目录实例。
export const diskStatusCache: StatusCache = createDiskStatusCache();
