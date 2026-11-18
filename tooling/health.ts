import { request } from "node:http";
import { request as tlsRequest } from "node:https";
import type { CertPaths } from "./tls.ts";
import { healthTlsOptions } from "./tls.ts";

/**
 * 健康检查：只打经核验实例上报的地址，带超时、禁止重定向，
 * 校验实例 ID 响应头 —— 不能把别的项目 200 当成功。
 */
export const INSTANCE_HEADER = "x-mode-instance";
export const HEALTH_PATH = "/__mode/health";

export interface HealthResult {
  ok: boolean;
  status?: number;
  instanceId?: string;
  instanceMatch?: boolean;
  error?: string;
  latencyMs?: number;
}

export function checkHealth(url: string, instanceId: string, certPaths: CertPaths): Promise<HealthResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const url_ = new URL(url);
    const doRequest = url_.protocol === "https:" ? tlsRequest : request;
    const req = doRequest(
      {
        hostname: url_.hostname,
        port: url_.port,
        path: `${HEALTH_PATH}?instance=${encodeURIComponent(instanceId)}`,
        method: "GET",
        timeout: 3000,
        headers: { accept: "application/json" },
        ...(url_.protocol === "https:" ? healthTlsOptions(certPaths, url_.hostname) : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const headerInstance = res.headers[INSTANCE_HEADER];
          const headerValue = Array.isArray(headerInstance) ? headerInstance[0] : headerInstance;
          resolve({
            ok: res.statusCode === 200 && headerValue === instanceId,
            status: res.statusCode,
            instanceId: headerValue,
            instanceMatch: headerValue === instanceId,
            latencyMs: Date.now() - started,
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "timeout after 3000ms", latencyMs: Date.now() - started });
    });
    req.on("error", (error: Error) => {
      resolve({ ok: false, error: error.message, latencyMs: Date.now() - started });
    });
    req.end();
  });
}
