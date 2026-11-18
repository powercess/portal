import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { RUN_FILE, STATE_DIR } from "./paths.ts";

/**
 * 运行状态（.local/mode/run.json）：一次启动的实例事实。
 * 与用户配置分开 —— 改配置不能踩到「正在运行」。
 */

export interface RunState {
  instanceId: string;
  /** dev | preview */
  mode: "dev" | "preview";
  pid: number;
  /** /proc/<pid>/stat 的 starttime（field 22，tick），用于 PID 复用检测。 */
  procStartTicks: string;
  startedAt: string;
  port: number;
  bindHost: string;
  scheme: "https" | "http";
  certSource: "self-signed" | "custom" | "none";
  command: string[];
}

export function readRunState(): RunState | undefined {
  if (!existsSync(RUN_FILE)) return undefined;
  try {
    return JSON.parse(readFileSync(RUN_FILE, "utf8")) as RunState;
  } catch {
    return undefined;
  }
}

export function writeRunState(state: RunState): void {
  mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
  const tmp = `${RUN_FILE}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, RUN_FILE);
}

export function clearRunState(): void {
  try {
    if (existsSync(RUN_FILE)) unlinkSyncSafe(RUN_FILE);
  } catch {
    // 状态文件删不掉不阻塞业务。
  }
}

function unlinkSyncSafe(path: string): void {
  (require("node:fs") as typeof import("node:fs")).unlinkSync(path);
}

/** 校验 PID 是否仍是当年的那个进程（防 PID 复用）。 */
export function pidIsSameProcess(state: RunState): boolean {
  try {
    const stat = readFileSync(`/proc/${state.pid}/stat`, "utf8");
    const afterComm = stat.slice(stat.lastIndexOf(")") + 2);
    const fields = afterComm.split(" ");
    return fields[19] === state.procStartTicks;
  } catch {
    return false;
  }
}

/** /proc/<pid>/stat 第 22 字段（含 comm 从 1 起数）：进程创建时刻的 tick。 */
export function procStartTicks(pid: number): string | undefined {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const afterComm = stat.slice(stat.lastIndexOf(")") + 2);
    return afterComm.split(" ")[19];
  } catch {
    return undefined;
  }
}

/** 向已核验的进程组发 SIGTERM，宽限后 SIGKILL。 */
export function stopPid(state: RunState, graceMs = 3000): boolean {
  if (!pidIsSameProcess(state)) return false;
  try {
    process.kill(-state.pid, "SIGTERM");
  } catch {
    try {
      process.kill(state.pid, "SIGTERM");
    } catch {
      return true;
    }
  }
  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline) {
    if (!pidIsSameProcess(state)) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  if (pidIsSameProcess(state)) {
    try {
      process.kill(-state.pid, "SIGKILL");
    } catch {
      try {
        process.kill(state.pid, "SIGKILL");
      } catch {
        // 已退出。
      }
    }
  }
  return true;
}

/** 日志文件轮转：name.log → name.1.log …，最多保留 LOG_KEEP 份。 */
export function rotateLogs(logFile: string, maxBytes: number, keep: number): void {
  const { statSync, renameSync, existsSync, unlinkSync } = require("node:fs") as typeof import("node:fs");
  if (!existsSync(logFile) || statSync(logFile).size < maxBytes) return;
  for (let index = keep - 1; index >= 1; index -= 1) {
    const from = index === 1 ? logFile : logFile.replace(/\.log$/, `.${index - 1}.log`);
    const to = logFile.replace(/\.log$/, `.${index}.log`);
    if (existsSync(from)) {
      try {
        if (existsSync(to)) unlinkSync(to);
        renameSync(from, to);
      } catch {
        // 轮转失败不阻塞。
      }
    }
  }
}
