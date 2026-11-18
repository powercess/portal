export const ORG = {
  name: "powercess",
  nameCN: "澎湃引擎",
  tagline: "把逆向、控制面和工程工具做成可靠的开源产品",
  description:
    "powercess 是一个学生开发团队的开源组织，聚焦 AI 网关、物联网协议逆向、" +
    "桌面应用与校园基础设施。我们相信：把系统做透明、把接口做诚实，" +
    "工具才会被人信任。",
  location: "China · 云南昆明",
  github: "https://github.com/powercess",
  founded: 2024,
} as const;

export interface Project {
  name: string;
  href: string;
  tagline: string;
  description: string;
  language: string;
  stars: number;
  pushedAt: string;
  topics: string[];
  featured?: boolean;
}

/** 数据来源：gh repo list powercess --json（2026-11-18 抓取，提交前核对过）。 */
export const PROJECTS: Project[] = [
  {
    name: "yimu-mcp",
    href: "https://github.com/powercess/yimu-mcp",
    tagline: "一木记账 MCP 服务器",
    description:
      "把一木记账网页版的能力封装成 AI 可直接调用的工具：扫码登录、全量/增量同步账单、" +
      "增删改查账单/资产/账本/标签，支持一句话记账解析。发布到 npm @powercess/yimu-mcp。",
    language: "TypeScript",
    stars: 6,
    pushedAt: "2026-10-25",
    topics: ["mcp", "fintech", "reverse-engineering"],
    featured: true,
  },
  {
    name: "mbrain",
    href: "https://github.com/powercess/mbrain",
    tagline: "Android MCP 网关",
    description:
      "面向本地与远程 AI Agent 的 Android 设备控制网关：设备信息、应用管理、文件操作、" +
      "命令执行、Root/Shizuku 访问，并把多个 MCP 服务聚合为 HTTP/stdio 端点。",
    language: "Kotlin",
    stars: 8,
    pushedAt: "2026-09-30",
    topics: ["android", "mcp", "ai-agents"],
    featured: true,
  },
  {
    name: "ticktick-mcp",
    href: "https://github.com/powercess/ticktick-mcp",
    tagline: "TickTick MCP 服务器",
    description:
      "基于 TickTick/滴答清单私有 Web API 的 MCP 服务器——cookie 认证，" +
      "覆盖完整任务/项目/标签/习惯/日历，实测约 164 个可用端点。",
    language: "TypeScript",
    stars: 0,
    pushedAt: "2026-09-30",
    topics: ["mcp", "productivity", "reverse-engineering"],
    featured: true,
  },
  {
    name: "jms-mcp",
    href: "https://github.com/powercess/jms-mcp",
    tagline: "JumpServer MCP 服务器",
    description: "JumpServer 堡垒机的 MCP 服务器（TypeScript 实现），让 AI 助手安全地查询和操作堡垒机资产。",
    language: "TypeScript",
    stars: 0,
    pushedAt: "2026-09-16",
    topics: ["mcp", "devops"],
  },
  {
    name: "yuketang-mcp",
    href: "https://github.com/powercess/yuketang-mcp",
    tagline: "雨课堂 MCP 服务器",
    description:
      "扫码登录雨课堂，让 AI 读取课程、课件、课堂回顾、AI 思维导图、回放时间线与作业进度。",
    language: "TypeScript",
    stars: 0,
    pushedAt: "2026-10-26",
    topics: ["mcp", "education"],
  },
  {
    name: "yunmu-ble-meter",
    href: "https://github.com/powercess/yunmu-ble-meter",
    tagline: "云牧蓝牙计量插座协议库",
    description:
      "对云牧 YM-S1-BES 蓝牙计量插座固件协议的逆向实现：客户端 + Prometheus exporter，" +
      "脱离厂商小程序直接读电压/功率/电能。",
    language: "Python",
    stars: 0,
    pushedAt: "2026-11-10",
    topics: ["ble", "iot", "prometheus", "reverse-engineering"],
    featured: true,
  },
  {
    name: "floatile",
    href: "https://github.com/powercess/floatile",
    tagline: "跨平台桌面 Widget 宿主",
    description:
      "把轻量、可组合、受控的 Widget 带到 Windows/macOS/Linux 桌面，" +
      "Rust + Slint + WASM Component Model 构建，插件链路以可复现证据验证。",
    language: "Rust",
    stars: 5,
    pushedAt: "2026-08-30",
    topics: ["desktop", "rust", "wasm", "widgets"],
    featured: true,
  },
  {
    name: "affinity-gateway",
    href: "https://github.com/powercess/affinity-gateway",
    tagline: "AI 请求会话亲和网关",
    description:
      "为 new-api 设计的 Caddy 会话亲和网关：入站会话规范化（UUIDv7）+ 出站厂商头适配，" +
      "Go 运行时，支持 Lua 请求转换插件。",
    language: "Go",
    stars: 0,
    pushedAt: "2026-10-03",
    topics: ["ai-gateway", "caddy", "go"],
  },
  {
    name: "printer_system",
    href: "https://github.com/powercess/printer_system",
    tagline: "校园自助打印系统",
    description:
      "面向校园的开源打印管理：多打印机负载均衡、用户钱包、微信/支付宝在线支付、" +
      "文件社区分享。Spring Boot + Nuxt。",
    language: "Java",
    stars: 0,
    pushedAt: "2026-03-29",
    topics: ["campus", "printing", "payments"],
  },
  {
    name: "OpenIndoor",
    href: "https://github.com/powercess/OpenIndoor",
    tagline: "开放室内导航",
    description: "融合多种定位技术的开放室内导航系统。",
    language: "Java",
    stars: 1,
    pushedAt: "2025-12-13",
    topics: ["indoor-positioning", "navigation"],
  },
  {
    name: "MinecraftAPI",
    href: "https://github.com/powercess/MinecraftAPI",
    tagline: "Fabric HTTP 接口模组",
    description: "为 Minecraft Fabric 端提供 HTTP 接口，让外部程序控制游戏内行为。",
    language: "Java",
    stars: 1,
    pushedAt: "2025-02-16",
    topics: ["minecraft", "fabric", "http-api"],
  },
];

export const CATEGORY_FILTERS = [
  { key: "all", label: "全部" },
  { key: "mcp", label: "MCP 工具" },
  { key: "ai", label: "AI 基础设施" },
  { key: "desktop", label: "桌面与物联网" },
  { key: "campus", label: "校园应用" },
] as const;

export type CategoryKey = (typeof CATEGORY_FILTERS)[number]["key"];

/** 项目 → 分类的稳定映射（一个项目可属于多类）。 */
export const CATEGORIES: Record<CategoryKey, string[]> = {
  all: PROJECTS.map((project) => project.name),
  mcp: ["yimu-mcp", "mbrain", "ticktick-mcp", "jms-mcp", "yuketang-mcp"],
  ai: ["affinity-gateway", "mbrain", "yimu-mcp", "ticktick-mcp"],
  desktop: ["floatile", "yunmu-ble-meter", "OpenIndoor"],
  campus: ["printer_system", "MinecraftAPI", "OpenIndoor"],
};
