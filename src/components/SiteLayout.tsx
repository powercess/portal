import { Link, NavLink, Outlet } from "react-router-dom";
import { ORG } from "../data/org";

const NAV_ITEMS = [
  { to: "/", label: "首页", end: true },
  { to: "/projects", label: "开源项目", end: false },
  { to: "/about", label: "关于我们", end: false },
  { to: "/join", label: "加入我们", end: false },
] as const;

export function SiteLayout() {
  return (
    <div className="site">
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            ⚡
          </span>
          <span className="brand-name">{ORG.name}</span>
        </Link>
        <nav aria-label="主导航">
          <ul className="nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <a className="header-github" href={ORG.github} target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      </header>
      <main id="main" className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <p>
          © {new Date().getFullYear()} {ORG.name} · {ORG.nameCN} ·{" "}
          <a href={ORG.github} target="_blank" rel="noreferrer">
            github.com/powercess
          </a>
        </p>
        <p className="footer-note">本站由 React + Vite 构建，源码与本站同仓库开源。</p>
      </footer>
    </div>
  );
}
