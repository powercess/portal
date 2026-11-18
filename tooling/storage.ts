import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./paths.ts";

/**
 * 磁盘水位与可重建资源清单。本项目是纯前端仓库：可重建资源只有
 * node_modules（重装便宜）和 dist（几秒重建）。没有镜像/数据卷 ——
 * 没有的资源不引入不存在的清理路径。
 */

export interface Candidate {
  label: string;
  path: string;
  bytes: number;
  /** 重建成本：node_modules 中（依赖下载+锁文件解析），dist 低（秒级 vite build）。 */
  cost: "low" | "medium";
  rationale: string;
}

export function diskUsage(): { totalBytes: number; usedBytes: number; percent: number; mount: string } | undefined {
  try {
    const { execFileSync } = require("node:child_process") as typeof import("node:child_process");
    const out = execFileSync("df", ["-B1", "--output=size,used,pcent,target", REPO_ROOT], { encoding: "utf8" });
    const lines = out.trim().split("\n");
    const parts = lines[lines.length - 1]?.split(/\s+/) ?? [];
    const totalBytes = Number(parts[0]);
    const usedBytes = Number(parts[1]);
    if (!Number.isFinite(totalBytes) || !Number.isFinite(usedBytes) || totalBytes === 0) return undefined;
    return { totalBytes, usedBytes, percent: Math.round((usedBytes / totalBytes) * 100), mount: parts[3] ?? REPO_ROOT };
  } catch {
    return undefined;
  }
}

function dirBytes(path: string): number {
  if (!existsSync(path)) return 0;
  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) total += dirBytes(full);
    else {
      try {
        total += statSync(full).size;
      } catch {
        // 消失的文件按 0 算。
      }
    }
  }
  return total;
}

/** 仓库内可重建资源（只报告，不删除）。 */
export function candidates(): Candidate[] {
  return [
    {
      label: "dist/ 生产构建",
      path: join(REPO_ROOT, "dist"),
      bytes: dirBytes(join(REPO_ROOT, "dist")),
      cost: "low",
      rationale: "vite build 秒级重建；start preview 时也会自动重建",
    },
    {
      label: "node_modules/ 依赖",
      path: join(REPO_ROOT, "node_modules"),
      bytes: dirBytes(join(REPO_ROOT, "node_modules")),
      cost: "medium",
      rationale: "bun install 从 lockfile 恢复；需网络",
    },
  ];
}

/** 水位判定：≥85% 高压（建议清理 medium），≥92% 临界（建议全部清理）。 */
export function pressureLevel(percent: number): "low" | "high" | "critical" {
  if (percent >= 92) return "critical";
  if (percent >= 85) return "high";
  return "low";
}

export function humanBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}
