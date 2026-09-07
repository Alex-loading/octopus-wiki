import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Moon, Sun, Search, Menu, X, FilePenLine, FlaskConical, Bookmark } from "lucide-react";
import { OctopusAvatar } from "./OctopusAvatar";
import { useAdminAuth } from "../context/AdminAuthContext";
import { createAdminLoginGesture, safeAdminReturnPath } from "../auth/adminSession";

interface NavbarProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  onSearchOpen: () => void;
}

export function Navbar({ darkMode, toggleDarkMode, onSearchOpen }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAdminAuth();
  const isAdmin = auth.isAdmin && !auth.checking && !auth.signingOut;
  const [authError, setAuthError] = useState("");
  const loginGesture = useRef(createAdminLoginGesture());

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setAuthError("");
    loginGesture.current = createAdminLoginGesture();
  }, [location]);

  useEffect(() => { loginGesture.current = createAdminLoginGesture(); }, [isAdmin]);

  const handleIdentityClick = async () => {
    if (auth.checking || auth.signingOut) return;
    if (isAdmin) {
      if (!window.confirm("退出管理员模式？")) return;
      setAuthError("");
      try { await auth.signOut(); }
      catch (error) { setAuthError(error instanceof Error ? error.message : "退出失败，请稍后重试。"); }
      return;
    }
    if (loginGesture.current(performance.now())) {
      const next = safeAdminReturnPath(location.pathname + location.search + location.hash);
      navigate(`/admin/login?next=${encodeURIComponent(next)}`);
    }
  };

  const navLinks: Array<{ href: string; label: string; icon?: typeof FlaskConical }> = [
    { href: "/", label: "首页" },
    { href: "/blog", label: "文章" },
    { href: "/collections", label: "收藏", icon: Bookmark },
    { href: "/lab", label: "实验室", icon: FlaskConical },
    { href: "/about", label: "关于" },
  ];
  if (isAdmin) navLinks.push({ href: "/admin/articles", label: "文章管理", icon: FilePenLine });
  if (isAdmin) navLinks.push({ href: "/admin/bookmarks", label: "收藏管理", icon: Bookmark });

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
            ? darkMode
              ? "bg-gray-950/90 backdrop-blur-xl border-b border-white/5 shadow-2xl shadow-black/20"
              : "bg-white/90 backdrop-blur-xl border-b border-black/5 shadow-lg shadow-black/5"
            : "bg-transparent"
          }`}
      >
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="relative flex shrink-0 items-center gap-2">
            <motion.button
              type="button"
              aria-label={isAdmin ? "退出管理员模式" : "Octopus"}
              title={isAdmin ? "管理员模式 · 点击退出" : "Octopus"}
              disabled={auth.checking || auth.signingOut}
              onClick={handleIdentityClick}
              whileHover={{ y: -1, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400 }}
              className="rounded-lg touch-manipulation select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500 disabled:cursor-wait"
            >
              <OctopusAvatar avatarId={isAdmin ? "focused" : "everyday"} administrator={isAdmin} className="w-9 h-9 rounded-lg" />
            </motion.button>
            <Link to="/" aria-label="返回首页" className={`tracking-tight ${darkMode ? "text-white" : "text-gray-900"}`}>
              <span className="opacity-60">by</span>{" "}
              <span className="font-semibold">Octopus</span>
            </Link>
            {authError && <p role="alert" className={`absolute left-0 top-full mt-3 w-64 rounded-xl border p-3 text-xs text-rose-500 shadow-lg ${darkMode ? "border-white/10 bg-gray-900" : "border-gray-200 bg-white"}`}>{authError}</p>}
          </div>

          {/* Desktop nav */}
          <nav aria-label="主导航" className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className={`relative px-2.5 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${isActive(link.href)
                      ? darkMode
                        ? "text-white"
                        : "text-gray-900"
                      : darkMode
                        ? "text-gray-400 hover:text-white"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                >
                  {isActive(link.href) && (
                    <motion.div
                      layoutId="nav-indicator"
                      className={`absolute inset-0 rounded-lg ${darkMode ? "bg-white/10" : "bg-gray-100"
                        }`}
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  {link.icon && (
                    <link.icon
                      size={13}
                      className="relative z-10 opacity-70"
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </motion.div>
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSearchOpen}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${darkMode
                  ? "bg-white/10 hover:bg-white/15 text-gray-300"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                }`}
            >
              <Search size={14} />
              <span>搜索</span>
              <kbd className={`text-xs px-1.5 py-0.5 rounded ${darkMode ? "bg-white/10 text-gray-400" : "bg-gray-200 text-gray-500"}`}>
                ⌘K
              </kbd>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSearchOpen}
              className={`md:hidden p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-100 text-gray-600"
                }`}
            >
              <Search size={18} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-100 text-gray-600"
                }`}
            >
              <AnimatePresence mode="wait">
                {darkMode ? (
                  <motion.div
                    key="sun"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Sun size={18} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="moon"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Moon size={18} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              className={`lg:hidden p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-100 text-gray-600"
                }`}
            >
              <AnimatePresence mode="wait">
                {menuOpen ? (
                  <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <X size={18} />
                  </motion.div>
                ) : (
                  <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Menu size={18} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className={`fixed top-16 left-0 right-0 z-40 lg:hidden border-b ${darkMode
                ? "bg-gray-950/95 backdrop-blur-xl border-white/5"
                : "bg-white/95 backdrop-blur-xl border-black/5"
              }`}
          >
            <nav id="mobile-navigation" aria-label="移动导航" className="px-6 py-4 flex flex-col gap-1">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={link.href}
                    className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive(link.href)
                        ? darkMode
                          ? "bg-white/10 text-white"
                          : "bg-gray-100 text-gray-900"
                        : darkMode
                          ? "text-gray-400 hover:text-white hover:bg-white/5"
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
