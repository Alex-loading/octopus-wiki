import { lazy, Suspense, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { SearchModal } from "./components/SearchModal";
import { Home } from "./pages/Home";
import { Blog } from "./pages/Blog";
import { Post } from "./pages/Post";
import { About } from "./pages/About";
import { Lab } from "./pages/Lab";
import { AdminArticles } from "./pages/AdminArticles";
import { AdminLogin } from "./pages/AdminLogin";
import { Collections } from "./pages/Collections";
import { Collect } from "./pages/Collect";
import { AdminDemos } from "./pages/AdminDemos";
import { AdminBookmarks } from "./pages/AdminBookmarks";
import { CollectorSetup } from "./pages/CollectorSetup";
import { useBlog } from "./context/BlogContext";

const PixelRoom = lazy(() => import("./pages/PixelRoom"));

function PageContent() {
  const location = useLocation();
  const { darkMode, setSearchOpen } = useBlog();
  const path = location.pathname;

  if (path === "/" || path === "") return <Home darkMode={darkMode} />;
  if (path === "/blog") return <Blog darkMode={darkMode} onSearchOpen={() => setSearchOpen(true)} />;
  if (path.startsWith("/post/")) return <Post darkMode={darkMode} />;
  if (path === "/about") return <About darkMode={darkMode} />;
  if (path === "/lab") return <Lab darkMode={darkMode} />;
  if (path === "/admin/login") return <AdminLogin darkMode={darkMode} />;
  if (path === "/admin/articles") return <AdminArticles darkMode={darkMode} />;
  if (path === "/collections" || /^\/collections\/[^/]+$/.test(path)) return <Collections darkMode={darkMode} />;
  if (path === "/collect") return <Collect darkMode={darkMode} />;
  if (path === "/collect/setup") return <CollectorSetup darkMode={darkMode} />;
  if (path === "/admin/demos") return <AdminDemos darkMode={darkMode} />;
  if (path === "/admin/bookmarks") return <AdminBookmarks darkMode={darkMode} />;
  return (
    <div className={`min-h-screen flex items-center justify-center pt-24 ${darkMode ? "bg-gray-950 text-white" : "bg-white text-gray-900"}`}>
      <div className="text-center">
        <h1 className="text-4xl font-light mb-4">404</h1>
        <p className={`mb-6 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>页面不存在</p>
        <a href="/" className={`text-sm underline ${darkMode ? "text-indigo-400" : "text-indigo-600"}`}>返回首页</a>
      </div>
    </div>
  );
}

export function Root() {
  const { darkMode, toggleDarkMode, searchOpen, setSearchOpen } = useBlog();
  const location = useLocation();
  const navigate = useNavigate();
  const [savedView, setSavedView] = useState(() => {
    try { return localStorage.getItem("octopus-home-view") === "list" ? "list" : "room"; }
    catch { return "room"; }
  });
  const requestedView = new URLSearchParams(location.search).get("view");
  const homeView = requestedView === "list" || requestedView === "room" ? requestedView : savedView;
  const isHome = location.pathname === "/";
  const isRoom = isHome && homeView === "room";
  const switchView = (view: "room" | "list") => {
    setSavedView(view);
    try { localStorage.setItem("octopus-home-view", view); } catch { /* Storage may be unavailable in private browsers. */ }
    navigate(`/?view=${view}`);
    window.scrollTo(0, 0);
  };

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-950" : "bg-white"}`}>
      <Navbar
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onSearchOpen={() => setSearchOpen(true)}
      />

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        darkMode={darkMode}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {isRoom ? <Suspense fallback={<div className={`min-h-screen flex items-center justify-center ${darkMode ? "bg-[#101513] text-[#d4b57b]" : "bg-[#eeeade] text-[#876134]"}`}>正在点亮小屋…</div>}>
            <PixelRoom onList={() => switchView("list")} />
          </Suspense> : <>
            {isHome && <button onClick={() => switchView("room")} className="fixed z-40 top-20 right-6 rounded border border-amber-700/40 bg-[#24372d] px-4 py-2 text-xs text-[#eee7d8] shadow-lg">进入像素小屋 ↗</button>}
            {isHome ? <Blog darkMode={darkMode} onSearchOpen={() => setSearchOpen(true)} /> : <PageContent />}
          </>}
        </motion.div>
      </AnimatePresence>

      {!isRoom && <Footer darkMode={darkMode} />}
    </div>
  );
}
