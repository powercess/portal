import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, openSync } from "node:fs";
import { LOG_DIR, LOG_MAX_BYTES, LOG_KEEP } from "./paths.ts";
import { rotateLogs, procStartTicks, type RunState } from "./state.ts";

/**
 * 程序化启动 Vite（不走 `bun run dev` 的子脚本层）：
 * dev → vite.createServer（HMR），preview → vite.preview。
 * TLS/端口由 server.tls / server.port 显式传入 —— 端口由我们指定，
 * EADDRINUSE 抛错由调用方按候选顺延；不让 Vite 自选端口。
 */

export interface SpawnResult {
  state: Omit<RunState, "pid" | "procStartTicks"> & { pid: number; procStartTicks: string };
  logFile: string;
}

export interface ViteSpawnOptions {
  mode: "dev" | "preview";
  port: number;
  scheme: "https" | "http";
  certSource: "self-signed" | "custom" | "none";
  instanceId: string;
  tls?: { cert: string; key: string };
}

/** 在 detached 子进程里跑 vite dev/preview；父进程退后仍存活。 */
export async function spawnVite(options: ViteSpawnOptions): Promise<SpawnResult> {
  mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 });
  const logFile = `${LOG_DIR}/vite-${options.mode}.log`;
  rotateLogs(logFile, LOG_MAX_BYTES, LOG_KEEP);
  const logFd = openSync(logFile, "a");

  const args = [
    "tooling/vite-serve.ts",
    options.mode,
    "--port", String(options.port),
    "--strictPort",
    "--host", "0.0.0.0",
  ];
  const child = spawn("bun", args, {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: {
      ...process.env,
      MODE_INSTANCE_ID: options.instanceId,
      ...(options.tls ? { MODE_TLS_CERT: options.tls.cert, MODE_TLS_KEY: options.tls.key } : {}),
    },
  });
  child.unref();
  closeFd(logFd);
  if (child.pid === undefined) throw new Error("Vite 进程启动失败");
  const ticks = procStartTicks(child.pid);
  if (ticks === undefined) throw new Error(`子进程 ${child.pid} 启动后立即退出（见 ${logFile}）`);
  return {
    state: {
      instanceId: options.instanceId,
      mode: options.mode,
      pid: child.pid,
      procStartTicks: ticks,
      startedAt: new Date().toISOString(),
      port: options.port,
      bindHost: "0.0.0.0",
      scheme: options.scheme,
      certSource: options.certSource,
      command: ["bun", ...args],
    },
    logFile,
  };
}

function closeFd(fd: number): void {
  (require("node:fs") as typeof import("node:fs")).closeSync(fd);
}

export function appendLog(line: string): void {
  mkdirSync(LOG_DIR, { recursive: true });
  appendFileSync(`${LOG_DIR}/mode.log`, `${new Date().toISOString()} ${line}\n`);
}

export function logExists(path: string): boolean {
  return existsSync(path);
}
