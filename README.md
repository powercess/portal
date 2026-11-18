# portal

powercess 组织门户站点：介绍组织与开源项目的 React 单页应用（4 个页面：首页 / 开源项目 / 关于 / 加入），附 `bun run mode:*` 本地开发管理。

## 快速开始

```bash
bun install
bun run mode:start        # 启动 dev（Vite HMR，默认自签 HTTPS）
```

启动成功后输出本机与局域网访问地址（端口从仓库路径派生，本仓库是 `42344` 起）：

```text
本机访问    https://127.0.0.1:42344  HTTPS · 自签 · 信任未验证
局域网访问  https://192.168.182.166:42344  实际监听 0.0.0.0 · HTTPS
```

## 命令

| 命令 | 用途 |
|---|---|
| `bun run mode:start` | 启动当前模式（默认 dev）。自签 HTTPS、`0.0.0.0` 监听、健康通过才报告成功 |
| `bun run mode:start preview` | 切到生产预览（`vite build` + `vite preview`） |
| `bun run mode:stop` | 停止运行中的实例（核验 PID 身份后发 SIGTERM） |
| `bun run mode:restart` | 重启当前模式进程，不重新构建 |
| `bun run mode:reload` | 应用最新代码：dev 确认 HMR 就绪；preview 重新构建 + 重启 + 等健康 |
| `bun run mode:status` | 状态面板：模式、运行状态、URL、健康、证书、磁盘水位 |
| `bun run mode:health` | 健康检查（校验实例 ID 头，不只是 200）；`--json` 机器可读 |
| `bun run mode:logs` | Vite 日志（最近 80 行）；`-f` 跟踪 |
| `bun run mode:clean` | 清理预览（只读）；`--force` 执行：删 `dist/`，无运行进程时删 `node_modules/` |
| `bun run mode:help` | 命令帮助 |

`status --json`、`health --json`、`clean --json` 输出机器可读 JSON；其余输出面向人类（`NO_COLOR` 只去色不去排版）。

## 模式

两种运行配置，保存在 `.local/mode.json`（Git 忽略）的 `mode` 字段：

- **dev** —— `vite.createServer` + HMR，改源码即时生效。适合开发。
- **preview** —— 生产构建产物预览。适合验证打包结果。

没有容器模式：纯前端项目不需要 Docker。

## HTTPS 证书

默认自签（`openssl` 签发，SAN 覆盖 `localhost`、`127.0.0.1` 与局域网 IP），证书在 `.local/mode/tls/`，私钥 `0600`。自签不等于浏览器自动信任 —— Firefox 手动导入 `cert.pem` 到证书颁发机构；Chrome 需加入系统信任库（方法见 `bun run mode:status`）。

用自己的证书：`.local/mode.json` 配 `"certPath"` + `"keyPath"`。

健康检查客户端显式信任本项目证书并校验主机名；全局关闭证书校验不是选项。

## 常用操作

```bash
bun run mode:start              # dev + HTTPS
bun run mode:status             # 状态面板
bun run mode:reload             # 应用新代码
bun run mode:logs -f            # 跟日志
bun run mode:clean --dry-run    # 清理预览
bun run mode:health --json      # CI 友好的健康探测
```

## 站点结构

```text
src/
  pages/        Home / Projects / About / Join
  components/   SiteLayout（导航+页脚）、ProjectCard
  data/org.ts   项目数据（来自 gh repo list powercess --json，手写维护）
```

新增项目：编辑 `src/data/org.ts` 的 `PROJECTS`，归入对应 `CATEGORIES` 分类即可。
