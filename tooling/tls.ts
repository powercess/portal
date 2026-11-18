import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { REPO_KEY, TLS_DIR } from "./paths.ts";

/**
 * 自签证书：SAN 覆盖 localhost / 127.0.0.1 / 局域网 IP。
 * 私钥 0600，不进 Git（.local/ 已忽略），不进镜像。
 * 用户可在 .local/mode.json 配 certPath/keyPath 用自己的证书。
 *
 * 信任说明：自签不等于浏览器自动信任 —— 状态面板会如实标注
 * 「信任未验证」并给出证书路径。用 mkcert 或系统 CA 签发的证书
 * 由用户自行放入，本工具只校验文件有效性。
 */

export interface CertPaths {
  cert: string;
  key: string;
  /** 证书来源：self-signed / custom / none。 */
  source: "self-signed" | "custom" | "none";
  /** SAN 是否覆盖给定主机（用于地址变化时重签）。 */
}

export function certPaths(): CertPaths {
  return {
    cert: join(TLS_DIR, "cert.pem"),
    key: join(TLS_DIR, "key.pem"),
    source: "self-signed",
  };
}

function openssl(args: string[]): string {
  return execFileSync("openssl", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function certSans(certPath: string): string[] {
  try {
    const text = openssl(["x509", "-in", certPath, "-noout", "-ext", "subjectAltName"]);
    return [...text.matchAll(/IP Address:([^,\s]+)|DNS:([^,\s]+)/g)].map((m) => m[1] ?? m[2] ?? "");
  } catch {
    return [];
  }
}

function certNotAfter(certPath: string): Date | undefined {
  try {
    const text = openssl(["x509", "-in", certPath, "-noout", "-enddate"]);
    const value = text.split("=")[1]?.trim();
    return value ? new Date(value) : undefined;
  } catch {
    return undefined;
  }
}

async function localIps(): Promise<string[]> {
  const ips: string[] = ["127.0.0.1"];
  try {
    const os = await import("node:os");
    for (const list of Object.values(os.networkInterfaces())) {
      for (const entry of list ?? []) {
        if (entry.family === "IPv4" && !entry.internal) ips.push(entry.address);
      }
    }
  } catch {
    // 枚举失败就用回环 + localhost。
  }
  return ips;
}

/** 确保证书可用：复用未过期且 SAN 匹配的，否则重签。失败抛错（不静默降级 HTTP）。 */
export async function ensureCert(customCert?: string, customKey?: string): Promise<CertPaths> {
  if (customCert !== undefined && customKey !== undefined) {
    if (!existsSync(customCert) || !existsSync(customKey)) {
      throw new Error(`自定义证书不存在：${customCert} / ${customKey}`);
    }
    return { cert: customCert, key: customKey, source: "custom" };
  }

  mkdirSync(TLS_DIR, { recursive: true, mode: 0o700 });
  const { cert, key } = certPaths();

  const notAfter = existsSync(cert) ? certNotAfter(cert) : undefined;
  const sans = existsSync(cert) ? certSans(cert) : [];
  const wanted = await localIps();
  const valid =
    notAfter !== undefined &&
    notAfter.getTime() > Date.now() + 24 * 3600 * 1000 &&
    sans.length > 0 &&
    wanted.every((ip) => sans.includes(ip));

  if (valid) return { cert, key, source: "self-signed" };

  const sanArg = [...wanted.map((ip) => `IP:${ip}`), "DNS:localhost"].join(",");
  const cnf = join(TLS_DIR, "openssl.cnf");
  writeOpensslCnf(cnf, sanArg);
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "397",
    "-keyout", key, "-out", cert,
    "-subj", `/CN=portal-${REPO_KEY}`,
    "-config", cnf, "-extensions", "req_ext",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  try { execFileSync("openssl", ["dhparam", "-out", join(TLS_DIR, "dhparam.pem"), "2048"], { stdio: ["ignore", "ignore", "ignore"] }); } catch { /* 可选 */ }
  return { cert, key, source: "self-signed" };
}

function writeOpensslCnf(path: string, san: string): void {
  const { writeFileSync } = require("node:fs") as typeof import("node:fs");
  const { chmodSync } = require("node:fs") as typeof import("node:fs");
  writeFileSync(
    path,
    [
      "[req]",
      "distinguished_name = dn",
      "x509_extensions = req_ext",
      "prompt = no",
      "",
      "[dn]",
      "CN = portal",
      "",
      "[req_ext]",
      `subjectAltName = ${san}`,
      "basicConstraints = critical,CA:FALSE",
      "keyUsage = critical,digitalSignature,keyEncipherment",
      "extendedKeyUsage = serverAuth",
      "",
    ].join("\n"),
  );
  chmodSync(path, 0o600);
}

/** 证书摘要信息（状态面板展示用）。 */
export function certSummary(paths: CertPaths): { notAfter?: Date; sans: string[] } {
  if (paths.source === "none") return { sans: [] };
  const cert = paths.cert;
  if (!existsSync(cert)) return { sans: [] };
  const stat = statSync(cert);
  if (stat.size === 0) return { sans: [] };
  return { notAfter: certNotAfter(cert), sans: certSans(cert) };
}

/** 健康检查用的 TLS Agent：显式信任本项目证书（rejectUnauthorized 按证书校验，不是全局关）。 */
export function healthTlsOptions(paths: CertPaths, host: string): { ca?: string; rejectUnauthorized: boolean } {
  // source none：调用方明确说不用 TLS 校验占位（HTTP 场景），返回 undefined 让请求走默认。
  if (paths.source === "none") return { rejectUnauthorized: false };
  // 自签/自定义：显式提供 CA，仍然校验主机名 —— 错误证书/错误 SAN 必须失败。
  return { ca: readFileSync(paths.cert, "utf8"), rejectUnauthorized: true };
}
