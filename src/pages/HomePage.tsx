import { Link } from "react-router-dom";
import { ORG, PROJECTS } from "../data/org";
import { ProjectCard } from "../components/ProjectCard";

const HIGHLIGHTS = [
  {
    title: "协议逆向 · 让封闭设备开口",
    body: "从云牧蓝牙插座的 hex 指令，到雨课堂、一木记账、滴答清单的私有 API——我们逆向协议，公开证据，把能力还给用户。",
  },
  {
    title: "MCP 生态 · 给 AI 接上真实世界",
    body: "一木记账、雨课堂、TickTick、JumpServer、Android 设备……我们维护一组可落地的 MCP 服务器，让 AI 助手不只是聊天。",
  },
  {
    title: "基础设施 · 从网关到校园",
    body: "AI 请求的会话亲和网关、代理出口池控制面、自助打印系统：把学生项目做成可运维的产品。",
  },
] as const;

export function HomePage() {
  const featured = PROJECTS.filter((project) => project.featured === true).slice(0, 6);
  return (
    <>
      <section className="hero">
        <p className="hero-eyebrow">开源组织 · {ORG.location}</p>
        <h1 className="hero-title">
          {ORG.name}
          <span className="hero-cn">{ORG.nameCN}</span>
        </h1>
        <p className="hero-tagline">{ORG.tagline}</p>
        <p className="hero-desc">{ORG.description}</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/projects">
            浏览项目
          </Link>
          <a className="btn btn-ghost" href={ORG.github} target="_blank" rel="noreferrer">
            GitHub 组织 ↗
          </a>
        </div>
      </section>

      <section className="highlights" aria-label="我们在做什么">
        {HIGHLIGHTS.map((item) => (
          <article key={item.title} className="highlight-card">
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section className="featured" aria-label="精选项目">
        <header className="section-head">
          <h2>精选项目</h2>
          <Link to="/projects" className="section-more">
            全部 {PROJECTS.length} 个项目 →
          </Link>
        </header>
        <div className="project-grid">
          {featured.map((project) => (
            <ProjectCard key={project.name} project={project} />
          ))}
        </div>
      </section>
    </>
  );
}
