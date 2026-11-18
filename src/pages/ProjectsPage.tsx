import { useMemo, useState } from "react";
import { CATEGORY_FILTERS, CATEGORIES, PROJECTS, type CategoryKey } from "../data/org";
import { ProjectCard } from "../components/ProjectCard";

export function ProjectsPage() {
  const [category, setCategory] = useState<CategoryKey>("all");

  const visible = useMemo(() => {
    const names = new Set(CATEGORIES[category]);
    const filtered = PROJECTS.filter((project) => names.has(project.name));
    return [...filtered].sort((a, b) => b.pushedAt.localeCompare(a.pushedAt));
  }, [category]);

  return (
    <>
      <header className="page-head">
        <h1>开源项目</h1>
        <p>以下为组织公开仓库（非 fork、非归档），按最近提交排序。私有项目不在列表中。</p>
      </header>

      <div className="filter-row" role="group" aria-label="按分类筛选">
        {CATEGORY_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={category === item.key ? "filter-chip active" : "filter-chip"}
            aria-pressed={category === item.key}
            onClick={() => setCategory(item.key)}
          >
            {item.label}
            <span className="filter-count">{CATEGORIES[item.key].length}</span>
          </button>
        ))}
      </div>

      <p className="result-note" aria-live="polite">
        {visible.length} 个项目
      </p>

      <div className="project-grid">
        {visible.map((project) => (
          <ProjectCard key={project.name} project={project} />
        ))}
      </div>
    </>
  );
}
