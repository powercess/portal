/**
 * `bun tooling/vite-serve.ts <dev|preview> -- --port N --strictPort --host 0.0.0.0`
 *
 * mode:start 的 detached 子进程入口：dev → vite.createServer（HMR），
 * preview → vite.preview（dist/ 产物）。端口/主机从 argv；TLS 证书从
 * MODE_TLS_CERT/MODE_TLS_KEY。注入 /__mode/health 健康端点（带实例 ID 头）。
 */
import { argv, env } from "node:process";
import { readFileSync } from "node:fs";
import { createServer, preview } from "vite";

function arg(name: string, fallback?: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] !== undefined ? (argv[index + 1] as string) : fallback;
}

const mode = argv[2] === "preview" ? "preview" : argv[2] === "dev" ? "dev" : undefined;
if (mode === undefined) {
  console.error("用法: bun tooling/vite-serve.ts <dev|preview> -- --port N --strictPort --host 0.0.0.0");
  process.exit(1);
}

const port = Number(arg("--port", "0"));
const strictPort = argv.includes("--strictPort");
const host = arg("--host", "0.0.0.0");

if (!Number.isInteger(port) || port <= 0) {
  console.error("需要 --port <number>");
  process.exit(1);
}

const certPath = env.MODE_TLS_CERT;
const keyPath = env.MODE_TLS_KEY;
const tls =
  certPath !== undefined && keyPath !== undefined
    ? { cert: readFileSync(certPath, "utf8"), key: readFileSync(keyPath, "utf8") }
    : undefined;

const instanceId = env.MODE_INSTANCE_ID ?? "unknown";

type ConnectNext = (error?: unknown) => void;
type ConnectReq = { url?: string };
type ConnectRes = {
  setHeader: (k: string, v: string) => void;
  end: (body?: string) => void;
};

/** 栈顶中间件看到所有请求：只接管 /__mode/health，其余调 next() 交给 Vite 处理。 */
function healthHandler(req: ConnectReq, res: ConnectRes, next: ConnectNext): void {
  const url = req.url ?? "";
  if (!url.startsWith("/__mode/health")) {
    next();
    return;
  }
  res.setHeader("x-mode-instance", instanceId);
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ ok: true, instance: instanceId, mode }));
}

if (mode === "dev") {
  const server = await createServer({
    configFile: "vite.config.ts",
    server: {
      port,
      strictPort,
      host,
      ...(tls ? { https: { cert: tls.cert, key: tls.key } } : {}),
    },
  });
  await server.listen();
  // listen 之后 unshift 到栈顶：connect 的路径前缀 use 会被 Vite 的 SPA fallback
  // 抢先（它重建栈），插在最前才保证 /__mode/health 命中。
  server.middlewares.stack.unshift({ route: "", handle: healthHandler });
  console.log(`[mode:vite:${mode}] ${tls === undefined ? "http" : "https"}://${host}:${port} instance=${instanceId}`);
} else {
  const server = await preview({
    configFile: "vite.config.ts",
    preview: {
      port,
      strictPort,
      host,
      ...(tls ? { https: { cert: tls.cert, key: tls.key } } : {}),
    },
  });
  if ("middlewares" in server) server.middlewares.stack.unshift({ route: "", handle: healthHandler });
  console.log(`[mode:vite:${mode}] ${tls === undefined ? "http" : "https"}://${host}:${port} instance=${instanceId}`);
}
