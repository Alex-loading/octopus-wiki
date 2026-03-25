import { useLocation } from "react-router";
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
import { useBlog } from "./context/BlogContext";

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
          <PageContent />
        </motion.div>
      </AnimatePresence>

      <Footer darkMode={darkMode} />
    </div>
  );
}