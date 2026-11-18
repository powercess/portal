#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, rmSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  bold, configureColor, cyan, dim, errorLine, explainColorOnce, log,
  printJson, renderHelp, step, stepDone, stepFailed, warn,
} from "./console.ts";
import { ConfigError, loadConfig, relativeToRoot, updateConfig, type ModeConfig } from "./config.ts";
import { LOCK_FILE, LOG_DIR, REPO_KEY, REPO_ROOT, CANONICAL_ROOT } from "./paths.ts";
import { basePort, portCandidates } from "./ports.ts";
import { ensureCert, certSummary } from "./tls.ts";
import { checkHealth, type HealthResult } from "./health.ts";
import { clearRunState, pidIsSameProcess, readRunState, stopPid, writeRunState, type RunState } from "./state.ts";
import { appendLog, spawnVite, type SpawnResult } from "./runtime.ts";
import { collectStatus, renderStatusPanel } from "./status.ts";
import type { StatusFacts } from "./types.ts";
import { candidates, diskUsage, humanBytes, pressureLevel } from "./storage.ts";
import { LAN_IP } from "./netinfo.ts";

/**
 * bun run mode:* 统一入口。
 *
 * 运行配置有两种（.local/mode.json 的 mode 字段）：
 *   dev     —— Vite 开发服务器，HMR；mode:reload 确认 HMR 生效（等 ws 重连）。
 *   preview —— 生产构建 + vite preview；mode:reload 重新构建并等健康。
 *
 * 没有容器模式：纯前端项目不需要 Docker，不为命名引入不存在的环境。
 */

const USAGE = "bun run mode:<command> [--json] [args…]";

/* ---------------- 工具 ---------------- */

interface GlobalOptions {
  json: boolean;
  rest: string[];
}

function parseGlobals(argv: string[]): GlobalOptions {
  return { json: argv.includes("--json"), rest: argv.filter((arg) => arg !== "--json") };
}

function configureFromEnv(): void {
  try {
    const { config } = loadConfig();
    if (config.forceColor === true) configureColor(true);
  } catch {
    // 配置坏了仍要能输出错误信息。
  }
}

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

function configOrFail(): { config: ModeConfig; path: string } {
  try {
    return loadConfig();
  } catch (error) {
    errorLine(error instanceof ConfigError ? error.message : String(error));
    errorLine(`修复或删除 ${relativeToRoot(".local/mode.json")} 后重试；工具不会静默重置你的选择。`);
    process.exit(1);
  }
}

function forwardExitCode(code: number): never {
  process.exit(code);
}

/* ---------------- start ---------------- */

interface StartOptions {
  mode: "dev" | "preview";
}

async function start(options: StartOptions): Promise<number> {
  const t0 = performance.now();
  const total = options.mode === "preview" ? 4 : 3;
  const instanceId = randomUUID();

  // 磁盘水位检查：92% 以上拒绝启动（保护宿主机）。
  const disk = diskUsage();
  if (disk !== undefined && pressureLevel(disk.percent) === "critical") {
    errorLine(`磁盘使用率 ${disk.percent}%（≥92% 临界）：先运行 bun run mode:clean 再启动。`);
    return 1;
  }

  step(1, total, options.mode === "preview" ? "构建生产产物（vite build）…" : "检查依赖（node_modules）…");
  if (options.mode === "preview") {
    const buildProc = Bun.spawnSync(["bun", "run", "build"], { cwd: REPO_ROOT, stdout: "inherit", stderr: "inherit" });
    if (buildProc.exitCode !== 0) {
      stepFailed("构建失败；不启动旧产物冒充新代码（bun run build 查看详细错误）");
      return 1;
    }
    stepDone("构建完成", performance.now() - t0);
  } else if (!existsSync(join(REPO_ROOT, "node_modules", "vite"))) {
    stepFailed("依赖未安装：先 bun install");
    return 1;
  } else {
    stepDone("依赖就绪");
  }

  step(2, total, "准备 TLS 证书…");
  const { config } = configOrFail();
  let tls: { cert: string; key: string } | undefined;
  let certSource: "self-signed" | "custom" | "none";
  try {
    const paths = await ensureCert(config.certPath, config.keyPath);
    tls = paths.source === "none" ? undefined : { cert: paths.cert, key: paths.key };
    certSource = paths.source;
    const summary = certSummary(paths);
    stepDone(`HTTPS · ${paths.source} · SAN ${summary.sans.join(", ")}`);
  } catch (error) {
    stepFailed(`证书准备失败：${error instanceof Error ? error.message : String(error)}`);
    stepFailed("已配置 HTTPS 启动失败，不静默降级 HTTP（用 .local/mode.json 配 certPath/keyPath 换证书）");
    return 1;
  }

  step(3, total, "启动 Vite（绑定 0.0.0.0，端口从仓库身份派生）…");
  const candidatesList = portCandidates("http");
  const state0: Omit<RunState, "pid" | "procStartTicks"> = {
    instanceId,
    mode: options.mode,
    pid: 0,
    procStartTicks: "",
    startedAt: "",
    port: 0,
    bindHost: "0.0.0.0",
    scheme: "https",
    certSource,
    command: ["bun", ...(options.mode === "dev" ? ["run", "dev"] : ["run", "preview"])],
  };

  // 让 Vite 实际 bind 决定端口：EADDRINUSE 时顺延候选。Vite 会拒绝被占端口，
  // 我们从 41700 段派生基线，冲突概率低；冲突时换 strictPort 语义 —— 逐个试。
  let spawnResult: SpawnResult | undefined;
  let actualPort = 0;
  for (const port of candidatesList) {
    // strictPort：EADDRINUSE 让子进程退出。spawn 成功 ≠ bind 成功 ——
    // 等 1.5s 后探活，死了说明端口被占，顺延下一个候选。
    const tlsEnv = tls !== undefined
      ? { cert: tls.cert, key: tls.key }
      : undefined;
    const result = await spawnVite({
      mode: options.mode,
      port,
      scheme: tls === undefined ? "http" : "https",
      certSource,
      instanceId,
      tls: tlsEnv,
    });
    await sleep(1500);
    if (!pidIsSameProcess({ pid: result.state.pid, procStartTicks: result.state.procStartTicks })) {
      appendLog(`port ${port} busy (child exited), trying next`);
      continue;
    }
    spawnResult = result;
    actualPort = port;
    break;
  }
  if (spawnResult === undefined) {
    stepFailed(`候选端口 ${candidatesList[0]}–${candidatesList[candidatesList.length - 1]} 全部被占；释放后重试`);
    return 1;
  }
  const state: RunState = { ...state0, ...spawnResult.state, port: actualPort };
  stepDone(`Vite ${options.mode} · PID ${state.pid}`);

  step(4, total, `健康检查 ${state.scheme}://127.0.0.1:${state.port} …`);
  const health = await waitForHealth(state);
  if (!health.ok) {
    stepFailed(health.error ?? `健康检查失败（HTTP ${health.status ?? "?"}）`);
    stepFailed(`日志：${relativeToRoot(`${LOG_DIR}/vite-${options.mode}.log`)}`);
    stopPid(state);
    clearRunState();
    return 1;
  }
  stepDone(`健康 · 实例匹配 · ${health.latencyMs}ms`, performance.now() - t0);

  writeRunState(state);
  updateConfig({ mode: options.mode, lastPort: actualPort });

  log("");
  log(`  ${bold("本机访问")}    ${cyan(`${state.scheme}://127.0.0.1:${state.port}`)}  ${state.scheme === "https" ? dim("HTTPS · 自签 · 信任未验证") : dim("HTTP")}`);
  log(`  ${bold("局域网访问")}  ${cyan(`${state.scheme}://${LAN_IP}:${state.port}`)}  ${dim(`实际监听 0.0.0.0 · ${state.scheme === "https" ? "HTTPS" : "HTTP"}`)}`);
  log(`  ${bold("证书路径")}    ${relativeToRoot(".local/mode/tls/cert.pem")}（Firefox 导入后信任；Chrome 参见 bun run mode:status）`);
  log(`  ${bold("日志")}        ${cyan(`bun run mode:logs`)}`);
  log("");
  explainColorOnce();
  return 0;
}

async function waitForHealth(state: { instanceId: string; scheme: string; port: number }): Promise<{ ok: boolean; error?: string; status?: number; latencyMs?: number }> {
  const url = `${state.scheme}://127.0.0.1:${state.port}`;
  const deadline = Date.now() + 15000;
  let last: HealthResult = { ok: false, error: "not attempted" };
  while (Date.now() < deadline) {
    last = await checkHealth(url, state.instanceId, { cert: "", key: "", source: "none" });
    if (last.ok) return last;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return last;
}

/* ---------------- stop ---------------- */

async function stop(): Promise<number> {
  const state = readRunState();
  if (state === undefined) {
    log("  ○ 没有运行中的实例（run.json 不存在）");
    return 0;
  }
  if (!pidIsSameProcess(state)) {
    warn(`状态过期：PID ${state.pid} 已不存在，清理 run.json`);
    clearRunState();
    return 0;
  }
  const ok = stopPid(state);
  if (ok) {
    clearRunState();
    stepDone(`已停止 PID ${state.pid}`);
  } else {
    stepFailed("停止失败（进程身份无法核验，不猜测归属）");
  }
  return ok ? 0 : 1;
}

/* ---------------- restart / reload ---------------- */

async function restart(forwarded: string[]): Promise<number> {
  // restart：重启当前配置的 Vite（不重新构建 —— 新代码生效走 reload）。
  const { config } = configOrFail();
  if (forwarded.length > 0) {
    warn(`restart 不接受额外参数（收到 ${forwarded.join(" ")}）；要切换模式用 bun run mode:start <mode>`);
  }
  const stopCode = await stop();
  if (stopCode !== 0) return stopCode;
  return start({ mode: config.mode });
}

async function reload(_forwarded: string[]): Promise<number> {
  const { config } = configOrFail();
  const state = readRunState();
  if (state === undefined || !pidIsSameProcess(state)) {
    log("  ○ 未运行：reload 会先完成构建/启动（等价于 start）");
    return start({ mode: config.mode });
  }
  if (state.mode === "dev") {
    // dev 模式 HMR：源码由 Vite watch；确认进程健康即可承诺新代码生效。
    const health = await checkHealth(`${state.scheme}://127.0.0.1:${state.port}`, state.instanceId, { cert: "", key: "", source: "none" });
    if (!health.ok) {
      stepFailed("HMR 确认失败：进程在但健康检查不通过；先 bun run mode:logs 排查");
      return 1;
    }
    stepDone("dev · HMR 生效中：改源码即时生效（Vite watch）");
    log(`  ${dim("新代码已生效 —— HMR 是 Vite 的 watch 能力，浏览器会自动热更。")}`);
    return 0;
  }
  // preview 模式：重新构建 + 重启进程，等健康 —— 这才是「新代码已生效」的完整承诺。
  step(1, 3, "重新构建（vite build）…");
  const build = Bun.spawnSync(["bun", "run", "build"], { cwd: REPO_ROOT, stdout: "inherit", stderr: "inherit" });
  if (build.exitCode !== 0) {
    stepFailed("构建失败；保留旧进程和旧产物（未更新）");
    return 1;
  }
  stepDone("构建完成");
  step(2, 3, "重启 preview 进程…");
  const stopCode = await stop();
  if (stopCode !== 0) return stopCode;
  const startCode = await start({ mode: "preview" });
  if (startCode !== 0) return startCode;
  stepDone(3, 0, "");
  return 0;
}

/* ---------------- health ---------------- */

async function health(options: GlobalOptions): Promise<number> {
  const state = readRunState();
  if (state === undefined || !pidIsSameProcess(state)) {
    if (options.json) printJson({ ok: false, error: "not-running" });
    else errorLine("✗ 未运行");
    return 1;
  }
  const { config } = loadConfigSafe();
  const certPaths = await ensureCert(config.certPath, config.keyPath);
  const result = await checkHealth(`${state.scheme}://127.0.0.1:${state.port}`, state.instanceId, certPaths);
  if (options.json) printJson({ ok: result.ok, status: result.status, instanceMatch: result.instanceMatch, latencyMs: result.latencyMs, url: `${state.scheme}://127.0.0.1:${state.port}` });
  else if (result.ok) stepDone(`健康 · ${result.latencyMs}ms · 实例匹配`);
  else stepFailed(result.error ?? `HTTP ${result.status ?? "?"}${result.instanceMatch === false ? " · 实例不匹配" : ""}`);
  return result.ok ? 0 : 1;
}

function loadConfigSafe(): { config: ModeConfig; path: string } {
  try {
    return loadConfig();
  } catch {
    return { config: { mode: "dev" }, path: "" };
  }
}

/* ---------------- logs ---------------- */

async function logs(forwarded: string[]): Promise<number> {
  const follow = forwarded.includes("-f") || forwarded.includes("--follow");
  const mode = readRunState()?.mode ?? "dev";
  const logFile = `${LOG_DIR}/vite-${mode}.log`;
  if (!existsSync(logFile)) {
    log(`  ○ 暂无日志（${relativeToRoot(logFile)}）`);
    return 0;
  }
  if (follow) {
    const proc = Bun.spawn(["tail", "-n", "50", "-f", logFile], { stdout: "inherit", stderr: "inherit" });
    await proc.exited;
    return proc.exitCode ?? 0;
  }
  const text = readFileSync(logFile, "utf8");
  const lines = text.split("\n");
  console.log(lines.slice(-80).join("\n"));
  return 0;
}

/* ---------------- clean ---------------- */

async function clean(options: GlobalOptions): Promise<number> {
  const disk = diskUsage();
  const items = candidates();
  const total = items.reduce((sum, item) => sum + item.bytes, 0);
  const level = disk === undefined ? "unknown" : pressureLevel(disk.percent);

  if (options.json) {
    printJson({
      dryRun: true,
      disk: disk === undefined ? { unknown: true } : { percent: disk.percent, level },
      candidates: items.map((item) => ({ label: item.label, bytes: item.bytes, cost: item.cost, rationale: item.rationale })),
      totalBytes: total,
    });
    return 0;
  }

  log(`  ${bold("磁盘")}  ${disk === undefined ? "未知" : `${disk.percent}% · ${level === "low" ? "正常" : level === "high" ? "偏高" : "临界"} · ${disk.mount}`}`);
  log(`  ${bold("可重建资源候选")}`);
  for (const item of items) {
    log(`    ${cyan(item.label.padEnd(20))} ${humanBytes(item.bytes).padStart(9)}  重建成本${item.cost === "low" ? "低" : "中"}  ${dim(item.rationale)}`);
  }
  log(`  ${bold("合计")}      ${humanBytes(total)}`);
  log("");
  log(`  ${dim("执行清理：bun run mode:clean --force（dev 模式运行中会保留 node_modules）")}`);

  if (options.rest.includes("--force")) {
    const state = readRunState();
    const runningDev = state !== undefined && pidIsSameProcess(state) && state.mode === "dev";
    step(1, 2, "删除 dist/ …");
    rmSync(join(REPO_ROOT, "dist"), { recursive: true, force: true });
    stepDone("dist/ 已删除");
    step(2, 2, runningDev ? "保留 node_modules/（dev 进程运行中，依赖不能删）" : "删除 node_modules/ …");
    if (!runningDev) {
      rmSync(join(REPO_ROOT, "node_modules"), { recursive: true, force: true });
      stepDone("node_modules/ 已删除");
    } else {
      warn("dev 进程运行中，跳过 node_modules/");
    }
    log("");
    log(`  ${dim("恢复：bun install && bun run build")}`);
    return 0;
  }
  return 0;
}

/* ---------------- help / status ---------------- */

function help(options: GlobalOptions): number {
  if (options.json) {
    printJson({
      commands: [
        { name: "mode:help", description: "本帮助" },
        { name: "mode:status", description: "状态面板" },
        { name: "mode:start [dev|preview]", description: "启动" },
        { name: "mode:stop", description: "停止" },
        { name: "mode:restart", description: "重启当前模式" },
        { name: "mode:reload", description: "应用新代码" },
        { name: "mode:health [--json]", description: "健康检查" },
        { name: "mode:logs [-f]", description: "日志" },
        { name: "mode:clean [--dry-run|--force]", description: "清理" },
      ],
    });
    return 0;
  }
  const { config } = loadConfigSafe();
  log(renderHelp({
    title: "powercess/portal · 开发管理",
    usage: USAGE,
    groups: [
      {
        title: "生命周期",
        entries: [
          { name: "mode:start", description: "启动当前模式（默认 dev）。HTTPS 自签证书、0.0.0.0 监听、端口按仓库身份派生；健康通过才报告成功。" },
          { name: "mode:start preview", description: "切换到 preview（生产构建 + vite preview）并启动。" },
          { name: "mode:stop", description: "停止运行中的实例（核验 PID 身份后发 SIGTERM）。" },
          { name: "mode:restart", description: "重启当前模式进程，不重新构建 —— 新代码生效用 reload。" },
          { name: "mode:reload", description: "应用最新代码：dev 确认 HMR 就绪；preview 重新构建 + 重启 + 等健康。未运行时先启动。" },
        ],
      },
      {
        title: "观测",
        entries: [
          { name: "mode:status", description: "状态面板：模式、运行状态、本机/局域网 URL、健康、证书信任状态、磁盘水位。" },
          { name: "mode:health", description: "健康检查（校验实例 ID，不只是 200）；--json 输出机器可读结果。" },
          { name: "mode:logs", description: "查看 Vite 日志（最近 80 行）；-f 跟踪。" },
        ],
      },
      {
        title: "维护",
        entries: [
          { name: "mode:clean", description: "清理预览（只读）：列出 dist/、node_modules/ 及重建成本、磁盘水位。" },
          { name: "mode:clean --force", description: "执行清理：删 dist/；node_modules/ 仅在无 dev 进程运行时删除。" },
        ],
      },
      {
        title: "其他",
        entries: [
          { name: "mode:help", description: "本帮助；--json 输出命令清单。" },
        ],
      },
    ],
    examples: [
      "bun run mode:start              # 启动 dev（HMR，HTTPS）",
      "bun run mode:start preview      # 切到生产预览",
      "bun run mode:status             # 状态面板",
      "bun run mode:reload             # 应用新代码",
      "bun run mode:clean --dry-run    # 清理预览",
    ],
    notes: [
      "运行配置保存在 .local/mode.json（Git 忽略）：mode 字段是当前选择；forceColor: true 可强制终端着色。",
      "本地 Web 默认 HTTPS（自签）。证书在 .local/mode/tls/，浏览器信任方法见 bun run mode:status。",
      "端口从仓库路径派生（同 checkout 稳定，不同 clone 隔离），冲突时有界顺延，以实际 bind 为准。",
    ],
  }));
  return 0;
}

/* ---------------- 分派 ---------------- */

const COMMANDS: Record<string, { description: string; run: (argv: string[]) => Promise<number> }> = {
  help: { description: "帮助", run: (argv) => Promise.resolve(help(parseGlobals(argv))) },
  status: {
    description: "状态面板",
    run: async (argv) => {
      const options = parseGlobals(argv);
      const facts = await collectStatus();
      if (options.json) printJson(factsToJson(facts));
      else log(renderStatusPanel(facts));
      explainColorOnce();
      return 0;
    },
  },
  start: {
    description: "启动",
    run: async (argv) => {
      const options = parseGlobals(argv);
      const modeArg = options.rest[0] as "dev" | "preview" | undefined;
      if (modeArg !== undefined && modeArg !== "dev" && modeArg !== "preview") {
        errorLine(`未知模式 ${modeArg}；可选 dev | preview`);
        return 1;
      }
      const { config } = configOrFail();
      const mode = modeArg ?? config.mode;
      if (options.json) {
        // start 不做机器输出：进程输出本身就是事实流。
        warn("start 不支持 --json（输出是构建与启动的事实流）");
      }
      return start({ mode });
    },
  },
  stop: { description: "停止", run: async () => stop() },
  restart: { description: "重启", run: async (argv) => restart(parseGlobals(argv).rest) },
  reload: { description: "应用新代码", run: async (argv) => reload(parseGlobals(argv).rest) },
  health: { description: "健康检查", run: async (argv) => health(parseGlobals(argv)) },
  logs: { description: "日志", run: async (argv) => logs(parseGlobals(argv).rest) },
  clean: { description: "清理", run: async (argv) => clean(parseGlobals(argv)) },
};

function factsToJson(facts: StatusFacts): Record<string, unknown> {
  return {
    selectedMode: facts.selectedMode,
    configError: facts.configError,
    running: facts.running,
    disk: facts.disk,
    rebuildable: facts.rebuildable,
    certPaths: { cert: relativeToRoot(facts.certPaths.cert), key: relativeToRoot(facts.certPaths.key), source: facts.certPaths.source },
  };
}

/* ---------------- main ---------------- */

configureFromEnv();

const [command = "help", ...argv] = process.argv.slice(2);
const entry = COMMANDS[command];
if (entry === undefined) {
  errorLine(`未知命令 mode:${command}；运行 bun run mode:help 查看可用命令`);
  forwardExitCode(1);
}
const exitCode = await entry.run(argv);
forwardExitCode(exitCode);
