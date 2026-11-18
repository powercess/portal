import { ORG } from "../data/org";

const VALUES = [
  {
    title: "证据优先",
    body: "逆向工程先留证据链：抓包记录、协议分析、可复现脚本。结论可以错，证据不能少。netsee、yunmu-ble-meter、tv-paper-api 都是这个习惯的产物。",
  },
  {
    title: "接口诚实",
    body: "基于私有 API 的工具必须写清边界：哪些端点官方不做兼容承诺、哪些行为随上游变化。不做兼容承诺的宣传，只做事实的记录。",
  },
  {
    title: "小而可用",
    body: "交付能跑的东西，而不是宏大但未完成的架构。学生团队的时间和注意力有限，优先把一个场景做透。",
  },
] as const;

const TIMELINE = [
  { year: "2024", text: "组织成立，从校园小程序与 Minecraft 插件起步。" },
  { year: "2025", text: "推出校园自助打印系统与室内导航项目，开始接触协议逆向。" },
  { year: "2026", text: "MCP 工具链成型：一木记账、雨课堂、TickTick、JumpServer；AI 网关与桌面 Widget 并行推进。" },
] as const;

export function AboutPage() {
  return (
    <>
      <header className="page-head">
        <h1>关于我们</h1>
        <p>
          {ORG.name}（{ORG.nameCN}）是一个 {ORG.location} 的学生开源团队，成立于 {ORG.founded} 年。
        </p>
      </header>

      <section aria-labelledby="focus-h">
        <h2 id="focus-h">我们关注什么</h2>
        <ul className="about-list">
          <li>
            <strong>AI 基础设施</strong>——网关、代理池、控制面：让模型请求可观测、可路由、可审计。
          </li>
          <li>
            <strong>MCP 工具链</strong>——把记账、课堂、待办、堡垒机、安卓设备接进 AI 助手。
          </li>
          <li>
            <strong>协议逆向与物联网</strong>——没有本地 API 的设备，就应该有本地 API。
          </li>
          <li>
            <strong>校园与桌面应用</strong>——自助打印、室内导航、跨平台 Widget。
          </li>
        </ul>
      </section>

      <section aria-labelledby="values-h">
        <h2 id="values-h">做事原则</h2>
        <div className="value-grid">
          {VALUES.map((value) => (
            <article key={value.title} className="value-card">
              <h3>{value.title}</h3>
              <p>{value.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="timeline-h">
        <h2 id="timeline-h">时间线</h2>
        <ol className="timeline">
          {TIMELINE.map((item) => (
            <li key={item.year}>
              <span className="timeline-year">{item.year}</span>
              <span>{item.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
