import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, ArrowRight, Clock, Tag } from "lucide-react";
import { listArticles } from "../content/repository";
import type { Post } from "../data/posts";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
}

export function SearchModal({ open, onClose, darkMode }: SearchModalProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? posts.filter(
      (p) =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.excerpt.toLowerCase().includes(query.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(query.toLowerCase())) ||
        p.category.toLowerCase().includes(query.toLowerCase())
    )
    : [];

  useEffect(() => {
    let cancelled = false;

    listArticles().then((items) => {
      if (cancelled) return;
      setPosts(items);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!open) return;
      }
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const dm = darkMode;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[15vh] px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={`w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl ${dm ? "bg-gray-900 border border-white/10" : "bg-white border border-gray-200"
                }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search input */}
              <div className={`flex items-center gap-3 px-4 border-b ${dm ? "border-white/10" : "border-gray-100"}`}>
                <Search size={18} className={dm ? "text-gray-400" : "text-gray-400"} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索文章、标签、分类..."
                  className={`flex-1 py-4 bg-transparent outline-none placeholder:text-gray-400 ${dm ? "text-white" : "text-gray-900"
                    }`}
                />
                {query && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={() => setQuery("")}
                    className={`p-1 rounded-lg ${dm ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-400"}`}
                  >
                    <X size={14} />
                  </motion.button>
                )}
                <kbd className={`text-xs px-2 py-1 rounded-lg ${dm ? "bg-white/10 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto">
                {!query && (
                  <div className="px-4 py-8 text-center">
                    <Search size={32} className={`mx-auto mb-3 ${dm ? "text-gray-600" : "text-gray-300"}`} />
                    <p className={`text-sm ${dm ? "text-gray-500" : "text-gray-400"}`}>
                      输入关键词开始搜索
                    </p>
                  </div>
                )}

                {query && filtered.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <p className={`text-sm ${dm ? "text-gray-500" : "text-gray-400"}`}>
                      没有找到 "{query}" 相关的文章
                    </p>
                  </div>
                )}

                {filtered.map((post, i) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Link
                      to={`/post/${post.slug}`}
                      onClick={onClose}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors group ${dm ? "hover:bg-white/5" : "hover:bg-gray-50"
                        }`}
                    >
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-12 h-10 object-cover rounded-lg shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${dm ? "text-white" : "text-gray-900"}`}>
                          {post.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs flex items-center gap-1 ${dm ? "text-gray-500" : "text-gray-400"}`}>
                            <Tag size={10} />
                            {post.category}
                          </span>
                          <span className={`text-xs flex items-center gap-1 ${dm ? "text-gray-500" : "text-gray-400"}`}>
                            <Clock size={10} />
                            {post.readTime} 分钟
                          </span>
                        </div>
                      </div>
                      <ArrowRight
                        size={14}
                        className={`mt-1 shrink-0 transition-transform group-hover:translate-x-1 ${dm ? "text-gray-600" : "text-gray-300"}`}
                      />
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              <div className={`px-4 py-2.5 border-t flex items-center gap-4 ${dm ? "border-white/5" : "border-gray-100"}`}>
                <span className={`text-xs ${dm ? "text-gray-600" : "text-gray-400"}`}>
                  {filtered.length > 0 ? `找到 ${filtered.length} 篇文章` : "共 " + posts.length + " 篇文章"}
                </span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
