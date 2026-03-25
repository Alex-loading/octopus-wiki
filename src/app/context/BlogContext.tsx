import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface BlogContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const BlogContext = createContext<BlogContextType>({
  darkMode: false,
  toggleDarkMode: () => {},
  searchOpen: false,
  setSearchOpen: () => {},
});

export function BlogProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem("blog-dark-mode");
    if (stored !== null) return stored === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("blog-dark-mode", String(darkMode));
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <BlogContext.Provider
      value={{
        darkMode,
        toggleDarkMode: () => setDarkMode((d) => !d),
        searchOpen,
        setSearchOpen,
      }}
    >
      {children}
    </BlogContext.Provider>
  );
}

export const useBlog = () => useContext(BlogContext);
