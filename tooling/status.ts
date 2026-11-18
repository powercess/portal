import { existsSync } from "node:fs";
import { CERT_HOWTO, formatPanel, type StatusFacts } from "./format.ts";
import { readRunState, pidIsSameProcess } from "./state.ts";
import { checkHealth, INSTANCE_HEADER } from "./health.ts";
import { loadConfig } from "./config.ts";
import { certPaths } from "./tls.ts";
import { candidates, diskUsage, humanBytes, pressureLevel } from "./storage.ts";

/** 采集 status 事实：配置、运行状态、健康、磁盘。只读。 */
export async function collectStatus(): Promise<StatusFacts> {
  let configError: string | undefined;
  let selectedMode: "dev" | "preview" | undefined;
  try {
    const { config } = loadConfig();
    selectedMode = config.mode;
  } catch (error) {
    configError = error instanceof Error ? error.message : String(error);
  }

  const state = readRunState();
  let running: StatusFacts["running"] = { alive: false };
  if (state !== undefined) {
    if (!pidIsSameProcess(state)) {
      running = { alive: false, stale: true, note: `PID ${state.pid} 已不存在（状态过期，可 bun run mode:stop 清理）` };
    } else {
      const url = `${state.scheme}://127.0.0.1:${state.port}`;
      const health = await checkHealth(url, state.instanceId, certPaths());
      running = {
        alive: true,
        mode: state.mode,
        pid: state.pid,
        startedAt: state.startedAt,
        port: state.port,
        scheme: state.scheme,
        certSource: state.certSource,
        health,
        url,
      };
    }
  }

  const disk = diskUsage();
  const list = candidates();
  const totalRebuildable = list.reduce((sum, item) => sum + item.bytes, 0);

  return {
    configError,
    selectedMode,
    running,
    disk: disk === undefined ? { unknown: true } : { ...disk, level: pressureLevel(disk.percent) },
    rebuildable: { total: totalRebuildable, human: humanBytes(totalRebuildable), items: list },
    certPaths: certPaths(),
    certHowto: CERT_HOWTO,
    httpsAvailable: true,
  };
}

/** 渲染 status 面板（人类输出）；机器输出走 mode.ts 的 --json。 */
export function renderStatusPanel(facts: StatusFacts): string {
  return formatPanel(facts, INSTANCE_HEADER);
}
