import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CONFIG_PATH, REPO_ROOT } from "./paths.ts";

/**
 * `.local/mode.json` 的唯一 owner：所有读写都走这里，局部更新保留未知字段，
 * 并发更新以仓库锁串行化，写入用「临时文件 + rename」原子替换。
 */

export interface ModeConfig {
  /** 用户显式选择的启动配置：dev = Vite HMR，preview = 生产构建预览。 */
  mode: "dev" | "preview";
  /** 上次启动的实际端口（未运行时保留，便于排障）。 */
  lastPort?: number;
  /** 传入证书路径：使用自己的 CA 证书而不是自动自签。 */
  certPath?: string;
  /** 传入私钥路径（与 certPath 成对）。 */
  keyPath?: string;
  /** 强制终端着色（NO_COLOR/非 TTY 环境下的逃生口）。 */
  forceColor?: boolean;
  /** 干净构建：clean 只移除 dist，保护 node_modules。 */
  [key: string]: unknown;
}

export const DEFAULT_CONFIG: ModeConfig = { mode: "dev" };

export class ConfigError extends Error {}

function validate(raw: unknown): ModeConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ConfigError(`${CONFIG_PATH} 不是 JSON 对象`);
  }
  const rawObj = raw as Record<string, unknown>;
  if (rawObj.mode !== undefined && rawObj.mode !== "dev" && rawObj.mode !== "preview") {
    throw new ConfigError(`mode 必须是 "dev" 或 "preview"，当前是 ${JSON.stringify(rawObj.mode)}`);
  }
  if (rawObj.certPath !== undefined && typeof rawObj.certPath !== "string") {
    throw new ConfigError("certPath 必须是字符串");
  }
  if (rawObj.keyPath !== undefined && typeof rawObj.keyPath !== "string") {
    throw new ConfigError("keyPath 必须是字符串");
  }
  if ((rawObj.certPath === undefined) !== (rawObj.keyPath === undefined)) {
    throw new ConfigError("certPath 和 keyPath 必须成对出现");
  }
  return raw as ModeConfig;
}

/** 读配置；不存在返回默认值。损坏抛 ConfigError —— 不静默重置用户的选择。 */
export function loadConfig(): { config: ModeConfig; path: string } {
  if (!existsSync(CONFIG_PATH)) return { config: { ...DEFAULT_CONFIG }, path: CONFIG_PATH };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch (error) {
    throw new ConfigError(`${CONFIG_PATH} 解析失败：${error instanceof Error ? error.message : String(error)}`);
  }
  return { config: validate(raw), path: CONFIG_PATH };
}

/** 局部更新：合并给定字段，保留其余。调用方须持有仓库锁。 */
export function updateConfig(patch: Partial<ModeConfig>): ModeConfig {
  const { config } = loadConfig();
  const next = { ...config, ...patch };
  for (const key of Object.keys(next)) {
    if (next[key] === undefined) delete next[key];
  }
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  const tmp = join(dirname(CONFIG_PATH), ".mode.json.tmp");
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
  renameSync(tmp, CONFIG_PATH);
  return next;
}

/** 相对仓库根的展示路径。 */
export function relativeToRoot(path: string): string {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}
