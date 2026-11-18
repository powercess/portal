import { createHash } from "node:crypto";
import { CANONICAL_ROOT } from "./paths.ts";

/**
 * 端口派生：sha256("port:v1\0" + CANONICAL_ROOT + "\0" + service) → base。
 * 同一 checkout 稳定，不同 clone/服务不撞；与运行期实际绑定结果解耦 ——
 * 哈希只是起点，冲突时按有界候选顺延，最终以 bind 成功为准。
 */
const BASE_RANGE_START = 41700;
const BASE_RANGE_SIZE = 1000;
const MAX_CANDIDATES = 32;

export function basePort(service: string): number {
  const digest = createHash("sha256").update(`port:v1\0${CANONICAL_ROOT}\0${service}`).digest();
  const offset = digest.readUInt32BE(0) % BASE_RANGE_SIZE;
  return BASE_RANGE_START + offset;
}

/** 基线起的有界候选序列：仅 EADDRINUSE 时按序尝试。 */
export function portCandidates(service: string): number[] {
  const base = basePort(service);
  return Array.from({ length: MAX_CANDIDATES }, (_, index) => base + index);
}
