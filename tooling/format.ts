import {
  bold, cyan, dim, green, red, renderPanel, statusMark, yellow, type StatusKind,
} from "./console.ts";
import { relativeToRoot } from "./config.ts";
import type { StatusFacts } from "./types.ts";
import { LAN_IP } from "./netinfo.ts";

export const CERT_HOWTO =
  "自签证书不等于浏览器自动信任。Firefox：设置 → 隐私与安全 → 证书 → 查看证书 → 证书颁发机构 → 导入 cert.pem 并勾选信任。Chrome/Chromium 系统信任库：将 cert.pem 加入 /etc/ca-certificates/trust-source/anchors/ 后执行 trust extract-compat（需要 sudo，由你自行决定与执行）。";

/** 状态面板：标题、分隔线、对齐字段、分组留白、操作指引。 */
export function formatPanel(facts: StatusFacts, instanceHeader: string): string {
  const overall = overallKind(facts);
  const sections: Parameters<typeof renderPanel>[0]["sections"] = [];

  sections.push({
    title: "配置",
    rows: facts.configError !== undefined
      ? [
          { label: "错误", value: facts.configError },
          { label: "配置路径", value: relativeToRoot(".local/mode.json") },
        ]
      : [
          { label: "配置路径", value: relativeToRoot(".local/mode.json") },
          { label: "已选模式", value: facts.selectedMode === "dev" ? "dev（Vite HMR，改代码即时生效）" : "preview（生产构建预览）" },
        ],
  });

  if (facts.running.alive) {
    const run = facts.running;
    const healthText = run.health === undefined
      ? "未探测"
      : run.health.ok
        ? `✓ 200 · 实例匹配 · ${run.health.latencyMs}ms`
        : run.health.error ?? `✗ HTTP ${run.health.status ?? "?"}${run.health.instanceMatch === false ? " · 实例不匹配" : ""}`;
    sections.push({
      title: "运行状态",
      rows: [
        { label: "状态", value: run.stale ? "已失效" : "运行中", },
        ...(run.stale ? [] : [
          { label: "模式", value: run.mode === "dev" ? "dev" : "preview" },
          { label: "PID", value: String(run.pid) },
          { label: "启动时间", value: run.startedAt },
          { label: "本机访问", value: `${run.url} · ${run.scheme === "https" ? "HTTPS · 自签 · 信任未验证" : "HTTP"}` },
          { label: "局域网访问", value: `${run.scheme}://${LAN_IP}:${run.port}（实际监听 ${run.scheme === "https" ? "HTTPS" : "HTTP"} · 0.0.0.0）` },
          { label: "健康", value: healthText },
          { label: "证书", value: run.certSource === "self-signed" ? relativeToRoot(".local/mode/tls/cert.pem") : "自定义证书" },
        ]),
      ],
    });
  } else {
    sections.push({
      title: "运行状态",
      rows: [
        { label: "状态", value: "未运行" },
        ...(facts.running.note !== undefined ? [{ label: "提示", value: facts.running.note }] : []),
      ],
    });
  }

  sections.push({
    title: "磁盘",
    rows: facts.disk.unknown
      ? [{ label: "使用率", value: "未知（df 查询失败，不当作空间充足）" }]
      : [
          { label: "使用率", value: `${facts.disk.percent}% · ${facts.disk.level === "low" ? "正常" : facts.disk.level === "high" ? "偏高（≥85% 建议清理）" : "临界（≥92% 建议清理）"}` },
          { label: "挂载点", value: facts.disk.mount },
          { label: "可重建资源", value: `${facts.rebuildable.human}（bun run mode:clean --dry-run 查看）` },
        ],
  });

  sections.push({
    title: "证书",
    rows: [{ label: "信任说明", value: CERT_HOWTO }],
  });

  const footer = facts.running.alive && !facts.running.stale
    ? ["bun run mode:stop  停止 · bun run mode:reload  应用新代码 · bun run mode:logs  跟日志"]
    : [
        "bun run mode:start  启动（默认 dev；切换用 bun run mode:start preview）",
        "bun run mode:help  查看全部命令",
      ];

  return renderPanel({
    title: "powercess/portal · 开发管理",
    status: overall,
    sections,
    footer,
  });
}

function overallKind(facts: StatusFacts): { kind: StatusKind; text: string } {
  if (facts.configError !== undefined) return { kind: "err", text: "配置损坏" };
  if (facts.running.stale) return { kind: "warn", text: "状态过期" };
  if (facts.running.alive && facts.running.health !== undefined) {
    return facts.running.health.ok ? { kind: "ok", text: "运行中 · 健康" } : { kind: "err", text: "运行中 · 健康异常" };
  }
  if (facts.running.alive) return { kind: "warn", text: "运行中 · 健康未知" };
  return { kind: "idle", text: "未运行" };
}

export { bold, cyan, dim, green, red, statusMark, yellow };
