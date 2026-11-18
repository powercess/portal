import { ORG } from "../data/org";

const TRACKS = [
  {
    name: "MCP 与 Agent 工具链",
    stack: "TypeScript · Node/Bun",
    work: "为真实服务写 MCP 服务器：登录态逆向、工具设计、协议适配。",
  },
  {
    name: "AI 网关与控制面",
    stack: "Go · React",
    work: "会话亲和、渠道适配、代理出口池：做模型流量的可观测控制面。",
  },
  {
    name: "桌面与物联网",
    stack: "Rust · Python · BLE",
    work: "跨平台 Widget 宿主、蓝牙协议逆向、Prometheus 监控。",
  },
  {
    name: "校园产品",
    stack: "Java · Nuxt",
    work: "自助打印、室内导航：从需求到上线、支付与运维的完整闭环。",
  },
] as const;

export function JoinPage() {
  return (
    <>
      <header className="page-head">
        <h1>加入我们</h1>
        <p>
          我们是小规模学生团队，欢迎对「把东西做出来」有耐心的同学。方式是远程协作 + 不定期线下，
          代码评审用 GitHub，沟通用飞书。
        </p>
      </header>

      <section aria-labelledby="tracks-h">
        <h2 id="tracks-h">当前方向</h2>
        <div className="track-grid">
          {TRACKS.map((track) => (
            <article key={track.name} className="track-card">
              <h3>{track.name}</h3>
              <p className="track-stack">{track.stack}</p>
              <p>{track.work}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="how-h">
        <h2 id="how-h">如何开始</h2>
        <ol className="join-steps">
          <li>
            先用起来：挑一个项目克隆、跑通、提 issue 或 PR。真实的使用反馈比简历更能说明问题。
          </li>
          <li>
            在 GitHub 组织下开 issue 自我介绍，附上你做过的一件具体事（repo、文章或 demo）。
          </li>
          <li>
            通过一次小任务合作后加入组织。没有笔试，但有代码评审。
          </li>
        </ol>
        <p className="join-cta">
          <a className="btn btn-primary" href={ORG.github} target="_blank" rel="noreferrer">
            去 GitHub 看看 ↗
          </a>
        </p>
      </section>
    </>
  );
}
