import type { Project } from "../data/org";

interface Props {
  project: Project;
}

export function ProjectCard({ project }: Props) {
  return (
    <article className="project-card">
      <header className="project-head">
        <a className="project-name" href={project.href} target="_blank" rel="noreferrer">
          {project.name} <span aria-hidden="true">↗</span>
        </a>
        <span className="project-lang">{project.language}</span>
      </header>
      <p className="project-tagline">{project.tagline}</p>
      <p className="project-desc">{project.description}</p>
      <footer className="project-meta">
        <span className="project-stars" title={`${project.stars} stars`}>
          ★ {project.stars === 0 ? "—" : project.stars}
        </span>
        <span className="project-pushed" title="最近提交">
          更新于 {project.pushedAt}
        </span>
        {project.topics.map((topic) => (
          <span key={topic} className="project-topic">
            {topic}
          </span>
        ))}
      </footer>
    </article>
  );
}
