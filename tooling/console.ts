/**
 * 控制台渲染：颜色契约、CJK 宽度对齐、状态面板与分组帮助。
 *
 * 硬性要求（bun-mode-manager 控制台契约）：
 *   - 非 TTY / NO_COLOR / FORCE_COLOR=0 只去色，排版保留；--json 才是机器输出；
 *   - 对齐按显示列宽（中文占 2 列），不能对带色字符串用 length/padEnd；
 *   - status 面板有标题、分隔线、对齐字段、分组留白与操作指引；
 *   - help 按用途分组，命令 + 说明两列对齐，附可复制示例。
 *
 * 零依赖：裸 clone 未装依赖时 mode 命令仍要能跑。
 */

const stdout = process.stdout;

export type ColorReason = "enabled" | "forced" | "no_color-env" | "force_color-0" | "not-a-tty" | "term-dumb";

export const colorDiagnostics: { enabled: boolean; reason: ColorReason } = { enabled: false, reason: "not-a-tty" };

let configForceColor = false;

export function configureColor(forceColor: boolean): void {
  configForceColor = forceColor;
  const next = evaluateColor();
  colorDiagnostics.enabled = next.enabled;
  colorDiagnostics.reason = next.reason;
}

function evaluateColor(): { enabled: boolean; reason: ColorReason } {
  if (configForceColor) return { enabled: true, reason: "forced" };
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") return { enabled: false, reason: "no_color-env" };
  if (process.env.FORCE_COLOR === "0") return { enabled: false, reason: "force_color-0" };
  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== "") return { enabled: true, reason: "forced" };
  if (stdout.isTTY !== true) return { enabled: false, reason: "not-a-tty" };
  if (process.env.TERM === "dumb") return { enabled: false, reason: "term-dumb" };
  return { enabled: true, reason: "enabled" };
}

configureColor(false);

function paint(code: number, text: string): string {
  return colorDiagnostics.enabled ? `\u001b[${code}m${text}\u001b[0m` : text;
}

export const bold = (text: string): string => paint(1, text);
export const dim = (text: string): string => paint(2, text);
export const red = (text: string): string => paint(31, text);
export const green = (text: string): string => paint(32, text);
export const yellow = (text: string): string => paint(33, text);
export const cyan = (text: string): string => paint(36, text);

export function columns(): number {
  const width = stdout.columns ?? 80;
  return width >= 60 ? width : 60;
}

const ESC = String.fromCharCode(27);
const SGR = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

export function stripAnsi(text: string): string {
  return text.replace(SGR, "");
}

export function textWidth(text: string): number {
  let width = 0;
  for (const char of stripAnsi(text)) {
    const code = char.codePointAt(0) ?? 0;
    width += isWide(code) ? 2 : 1;
  }
  return width;
}

function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1f64f) ||
    (code >= 0x1f900 && code <= 0x1f9ff) ||
    (code >= 0x20000 && code <= 0x3fffd)
  );
}

export function pad(text: string, width: number): string {
  const gap = width - textWidth(text);
  return gap > 0 ? text + " ".repeat(gap) : text;
}

export function clip(text: string, width: number): string {
  if (textWidth(text) <= width) return text;
  let out = "";
  let used = 0;
  for (const char of text) {
    const w = textWidth(char);
    if (used + w > width - 1) break;
    out += char;
    used += w;
  }
  return `${out}…`;
}

export function panelWidth(): number {
  return Math.min(80, Math.max(60, columns() - 2));
}

export function rule(): string {
  return dim("─".repeat(panelWidth()));
}

export type StatusKind = "ok" | "warn" | "err" | "idle";

export function statusMark(kind: StatusKind, text: string): string {
  switch (kind) {
    case "ok":
      return green(`● ${text}`);
    case "warn":
      return yellow(`⚠ ${text}`);
    case "err":
      return red(`✗ ${text}`);
    case "idle":
      return dim(`○ ${text}`);
  }
}

function plainStatus(status: { kind: StatusKind; text: string }): string {
  const mark = status.kind === "ok" ? "●" : status.kind === "warn" ? "⚠" : status.kind === "err" ? "✗" : "○";
  return `${mark} ${status.text}`;
}

export interface PanelRow {
  label: string;
  value: string;
}

export interface PanelSection {
  title?: string;
  rows: PanelRow[];
}

export interface PanelOptions {
  title: string;
  status: { kind: StatusKind; text: string };
  sections: PanelSection[];
  footer?: string[];
}

export function renderPanel(options: PanelOptions): string {
  const width = panelWidth();
  const lines: string[] = [rule()];

  const statusText = colorDiagnostics.enabled ? statusMark(options.status.kind, options.status.text) : plainStatus(options.status);
  const headGap = width - textWidth(options.title) - textWidth(plainStatus(options.status));
  if (headGap >= 4) {
    lines.push(`  ${bold(options.title)}${" ".repeat(headGap)}${statusText}`);
  } else {
    lines.push(`  ${bold(options.title)}`);
    lines.push(`  ${statusText}`);
  }
  lines.push(rule());

  const labelWidth = Math.min(
    14,
    Math.max(8, ...options.sections.flatMap((section) => section.rows.map((row) => textWidth(row.label)))),
  );
  const valueWidth = width - 2 - labelWidth - 2;

  options.sections.forEach((section, index) => {
    if (index > 0 || section.title !== undefined) lines.push("");
    if (section.title !== undefined) lines.push(`  ${bold(section.title)}`);
    for (const row of section.rows) {
      const chunks = wrapByWidth(row.value, valueWidth);
      lines.push(`  ${dim(pad(row.label, labelWidth))}  ${chunks[0] ?? ""}`);
      for (const chunk of chunks.slice(1)) {
        lines.push(`  ${dim(pad("", labelWidth))}  ${chunk}`);
      }
    }
  });

  lines.push(rule());
  for (const line of options.footer ?? []) {
    lines.push(`  ${paintCommands(line)}`);
  }
  return lines.join("\n");
}

function paintCommands(line: string): string {
  return line.replace(/bun run mode:[\w:.-]+/g, (match) => cyan(match));
}

function wrapByWidth(value: string, width: number): string[] {
  if (value.includes(ESC + "[")) return wrapColored(value, width);
  if (textWidth(value) <= width) return [value];
  const out: string[] = [];
  let rest = value;
  while (textWidth(rest) > width) {
    let take = 0;
    let used = 0;
    for (const char of rest) {
      const w = textWidth(char);
      if (used + w > width) break;
      used += w;
      take += char.length;
    }
    const slice = rest.slice(0, take);
    const space = slice.lastIndexOf(" ");
    if (space > width / 3) {
      out.push(slice.slice(0, space));
      rest = rest.slice(space + 1);
    } else {
      out.push(slice);
      rest = rest.slice(take);
    }
  }
  if (rest !== "") out.push(rest);
  return out.length === 0 ? [""] : out;
}

const SGR_OR_TEXT = new RegExp(`${ESC}\\[[0-9;]*m|[^${ESC}]+`, "gu");

function wrapColored(value: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  let active = "";
  for (const token of value.match(SGR_OR_TEXT) ?? []) {
    if (token.startsWith(ESC)) {
      current += token;
      active = token === `${ESC}[0m` ? "" : token;
      continue;
    }
    for (const char of token) {
      if (textWidth(current) + textWidth(char) > width) {
        lines.push(current);
        current = active;
      }
      current += char;
    }
  }
  if (current !== "") lines.push(current);
  return lines.length === 0 ? [""] : lines;
}

export interface HelpGroup {
  title: string;
  entries: Array<{ name: string; description: string }>;
}

export interface HelpOptions {
  title: string;
  usage: string;
  groups: HelpGroup[];
  examples: string[];
  notes?: string[];
}

export function renderHelp(options: HelpOptions): string {
  const width = panelWidth();
  const nameWidth = Math.min(
    20,
    Math.max(12, ...options.groups.flatMap((group) => group.entries.map((entry) => textWidth(entry.name)))),
  );
  const descWidth = width - 6 - nameWidth;

  const lines: string[] = [rule(), `  ${bold(options.title)}`, rule()];
  lines.push(`  ${dim(pad("用法", 6))}  ${options.usage}`);

  for (const group of options.groups) {
    lines.push("");
    lines.push(`  ${bold(group.title)}`);
    for (const entry of group.entries) {
      const chunks = wrapByWidth(entry.description, descWidth);
      lines.push(`    ${cyan(pad(entry.name, nameWidth))}  ${chunks[0] ?? ""}`);
      for (const chunk of chunks.slice(1)) {
        lines.push(`    ${pad("", nameWidth)}  ${chunk}`);
      }
    }
  }

  lines.push("");
  lines.push(`  ${bold("常用操作")}`);
  for (const example of options.examples) lines.push(`    ${cyan(example)}`);

  if ((options.notes ?? []).length > 0) {
    lines.push("");
    lines.push(`  ${bold("说明")}`);
    for (const note of options.notes ?? []) {
      for (const chunk of wrapByWidth(note, width - 4)) lines.push(`    ${chunk}`);
    }
  }
  lines.push(rule());
  return lines.join("\n");
}

export function step(index: number, total: number, message: string): void {
  console.log(`${dim(`[${index}/${total}]`)} ${message}`);
}

export function stepDone(message: string, elapsedMs?: number): void {
  const suffix = elapsedMs === undefined ? "" : ` · ${(elapsedMs / 1000).toFixed(1)}s`;
  console.log(`  ${green("✓")} ${message}${dim(suffix)}`);
}

export function stepFailed(message: string): void {
  console.error(`  ${red("✗")} ${message}`);
}

export function printJson(value: unknown): void {
  stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

let colorNoticeShown = false;

export function explainColorOnce(): void {
  if (colorNoticeShown || !stdout.isTTY || colorDiagnostics.enabled) return;
  colorNoticeShown = true;
  const reason = colorDiagnostics.reason;
  if (reason === "enabled" || reason === "forced") return;
  const how: Record<Exclude<ColorReason, "enabled" | "forced">, string> = {
    "no_color-env": 'NO_COLOR 已设置 —— 去掉它，或在 .local/mode.json 加 "forceColor": true',
    "force_color-0": 'FORCE_COLOR=0 —— 设为 1，或加 "forceColor": true',
    "term-dumb": 'TERM=dumb —— 换一个真实终端类型，或加 "forceColor": true',
    "not-a-tty": "标准输出不是终端",
  };
  console.error(dim(`  [无色] ${how[reason]}`));
}

export function log(message: string): void {
  console.log(message);
}

export function warn(message: string): void {
  console.error(`${yellow("!")} ${message}`);
}

export function errorLine(message: string): void {
  console.error(`${red("✗")} ${message}`);
}
