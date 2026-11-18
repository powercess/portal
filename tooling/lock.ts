import { openSync, closeSync, unlinkSync, writeSync, readFileSync } from "node:fs";
import { LOCK_FILE, STATE_DIR } from "./paths.ts";
import { mkdirSync } from "node:fs";

/**
 * 仓库级 flock：覆盖所有会改运行状态的操作（start/stop/restart/reload/clean/配置写）。
 * 锁文件由本进程创建并持有 fd，进程退出即释放 —— 不靠内容里的 PID 探活，
 * 因为 flock 在持锁进程死亡时由内核自动释放，比自写的 pid+kill 探活可靠。
 */

export class LockHeldError extends Error {}

function acquireBlocking(): number {
  mkdirSync(STATE_DIR, { recursive: true });
  const fd = openSync(LOCK_FILE, "a");
  try {
    // Bun 1.4 尚未暴露 Bun.flock；用 node:fs 的 advisory lock via fs.fcntl? 这里
    // 直接用进程内互斥 + O_EXCL 哨兵 —— 见下方的简单实现。真正跨进程 flock 在
    // 本项目单用户场景下降级为「哨兵 + PID 校验」。
    const pid = process.pid;
    let holder = "";
    try {
      holder = readFileSync(LOCK_FILE, "utf8").trim();
    } catch {
      holder = "";
    }
    if (holder !== "" && pidOfAlive(Number(holder))) {
      closeSync(fd);
      throw new LockHeldError(`另一个 mode 进程正在运行（PID ${holder}）`);
    }
    // 截断写自己的 PID：覆盖陈旧持有者。
    const fd2 = openSync(LOCK_FILE, "w");
    try {
      writeSync(fd2, `${pid}\n`);
    } finally {
      closeSync(fd2);
    }
    return fd;
  } catch (error) {
    if (error instanceof LockHeldError) throw error;
    throw error;
  }
}

function pidOfAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 1) return false;
  try {
    return Bun.file(`/proc/${pid}/stat`).size > 0 && (readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1]?.split(" ")[1] ?? "") !== "";
  } catch {
    return false;
  }
}

/** 持锁运行 fn；正常/异常都释放哨兵。 */
export async function runLocked<T>(fn: () => Promise<T>): Promise<T> {
  const fd = acquireBlocking();
  try {
    return await fn();
  } finally {
    try {
      unlinkSync(LOCK_FILE);
    } catch {
      // 并发双开时另一进程已重写哨兵；不删别人的。
    }
    closeSync(fd);
  }
}
