import { Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/SiteLayout";
import { HomePage } from "./pages/HomePage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { AboutPage } from "./pages/AboutPage";
import { JoinPage } from "./pages/JoinPage";

export function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}
