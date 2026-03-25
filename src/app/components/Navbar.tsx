import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Moon, Sun, Search, Menu, X, Feather, FlaskConical } from "lucide-react";

interface NavbarProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  onSearchOpen: () => void;
}

export function Navbar({ darkMode, toggleDarkMode, onSearchOpen }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const navLinks: Array<{ href: string; label: string; icon?: typeof FlaskConical }> = [
    { href: "/", label: "首页" },
    { href: "/blog", label: "文章" },
    { href: "/lab", label: "实验室", icon: FlaskConical },
    { href: "/about", label: "关于" },
  ];

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
          <Link to="/" className="flex items-center gap-2 group">
            <motion.div
              whileHover={{ rotate: 15, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400 }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${darkMode ? "bg-indigo-500" : "bg-indigo-600"
                }`}
            >
              <Feather size={16} className="text-white" />
            </motion.div>
            <span className={`tracking-tight ${darkMode ? "text-white" : "text-gray-900"}`}>
              <span className="opacity-60">by</span>{" "}
              <span className="font-semibold">Octopus</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className={`relative px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${isActive(link.href)
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
              className={`md:hidden p-2 rounded-lg transition-colors ${darkMode ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-100 text-gray-600"
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
            className={`fixed top-16 left-0 right-0 z-40 md:hidden border-b ${darkMode
                ? "bg-gray-950/95 backdrop-blur-xl border-white/5"
                : "bg-white/95 backdrop-blur-xl border-black/5"
              }`}
          >
            <nav className="px-6 py-4 flex flex-col gap-1">
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