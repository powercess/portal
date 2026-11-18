import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * HTTPS 在 mode:start 里通过 server.tls 注入（tooling/tls.ts 签发的自签证书）。
 * 裸 `bun run dev` 时这里是 HTTP —— 那是绕过管理器的后门，mode:status 会如实标注。
 */
export default defineConfig(async ({ mode }): Promise<UserConfig> => ({
  plugins: [react()],
  server: { host: "0.0.0.0" },
  preview: { host: "0.0.0.0" },
  build: { outDir: "dist", sourcemap: mode === "production" ? false : true },
}));
