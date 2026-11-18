import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { basename, join, resolve } from "node:path";

/** 仓库根（符号链接未解析，用于相对路径展示）。 */
export const REPO_ROOT = resolve(import.meta.dir, "..");

/** 规范化仓库根：同一 checkout 重启稳定，不同 clone/worktree 自动隔离。 */
export const CANONICAL_ROOT = realpathSync(REPO_ROOT);

const IDENTITY_VERSION = "mode:v1";

function hashKey(...parts: string[]): string {
  return createHash("sha256").update(`${IDENTITY_VERSION}\0${parts.join("\0")}`).digest("hex");
}

/** 12 hex 仓库标识：资源命名空间（端口、证书、锁）。 */
export const REPO_KEY = hashKey(CANONICAL_ROOT).slice(0, 12);

const REPO_SLUG = basename(CANONICAL_ROOT).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** 用户配置（唯一读取来源），Git 忽略。 */
export const CONFIG_PATH = join(REPO_ROOT, ".local", "mode.json");

/** 运行状态目录：锁、日志、证书、实例状态。 */
export const STATE_DIR = join(REPO_ROOT, ".local", "mode");
export const LOCK_FILE = join(STATE_DIR, "lock");
export const RUN_FILE = join(STATE_DIR, "run.json");
export const LOG_DIR = join(STATE_DIR, "logs");
export const TLS_DIR = join(STATE_DIR, "tls");
export const LOG_MAX_BYTES = 10 * 1024 * 1024;
export const LOG_KEEP = 3;
