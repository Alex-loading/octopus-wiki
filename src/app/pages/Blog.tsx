import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, SlidersHorizontal, X, LayoutGrid, List } from "lucide-react";
import { listArticles } from "../content/repository";
import type { Post } from "../data/posts";
import { PostCard } from "../components/PostCard";

interface BlogProps {
  darkMode: boolean;
  onSearchOpen: () => void;
}

export function Blog({ darkMode, onSearchOpen }: BlogProps) {
  const dm = darkMode;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    let mounted = true;
    listArticles()
      .then((items) => {
        if (!mounted) return;
        setPosts(items);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const allTags = useMemo(() => Array.from(new Set(posts.flatMap((p) => p.tags))), [posts]);
  const allCategories = useMemo(() => Array.from(new Set(posts.map((p) => p.category))), [posts]);

  const filtered = useMemo(() => {
    return posts.filter((post) => {
      const matchSearch =
        !searchQuery ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCategory = !selectedCategory || post.category === selectedCategory;
      const matchTags =
        selectedTags.length === 0 || selectedTags.every((t) => post.tags.includes(t));

      return matchSearch && matchCategory && matchTags;
    });
  }, [posts, searchQuery, selectedCategory, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    setSelectedTags([]);
  };

  const hasFilters = searchQuery || selectedCategory || selectedTags.length > 0;

  return (
    <div className={`min-h-screen pt-24 pb-20 ${dm ? "bg-gray-950" : "bg-white"}`}>
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12"
        >
          <p className={`text-sm font-medium mb-2 ${dm ? "text-indigo-400" : "text-indigo-600"}`}>
            全部文章
          </p>
          <h1 className={`text-4xl font-light tracking-tight ${dm ? "text-white" : "text-gray-900"}`}>
            文章列表
          </h1>
          <p className={`mt-3 ${dm ? "text-gray-400" : "text-gray-500"}`}>
            共 {posts.length} 篇文章
          </p>
        </motion.div>

        {/* Search & filter bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-3 mb-6"
        >
          <div className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${dm
            ? "bg-gray-900 border-white/5 focus-within:border-indigo-500/50"
            : "bg-gray-50 border-gray-200 focus-within:border-indigo-300"
            }`}>
            <Search size={16} className={dm ? "text-gray-500" : "text-gray-400"} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索文章..."
              className={`flex-1 bg-transparent outline-none text-sm ${dm ? "text-white placeholder:text-gray-600" : "text-gray-900 placeholder:text-gray-400"}`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}>
                <X size={14} className={dm ? "text-gray-500" : "text-gray-400"} />
              </button>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${showFilters || hasFilters
              ? dm
                ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
                : "bg-indigo-50 border-indigo-200 text-indigo-600"
              : dm
                ? "bg-gray-900 border-white/5 text-gray-400 hover:border-white/10"
                : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
          >
            <SlidersHorizontal size={15} />
            筛选
            {(selectedCategory || selectedTags.length > 0) && (
              <span className={`text-xs w-4 h-4 rounded-full flex items-center justify-center ${dm ? "bg-indigo-500 text-white" : "bg-indigo-600 text-white"}`}>
                {(selectedCategory ? 1 : 0) + selectedTags.length}
              </span>
            )}
          </motion.button>

          <div className={`flex items-center gap-1 p-1 rounded-xl border ${dm ? "bg-gray-900 border-white/5" : "bg-gray-50 border-gray-200"}`}>
            {(["list", "grid"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-2 rounded-lg transition-all ${viewMode === mode
                  ? dm ? "bg-white/10 text-white" : "bg-white text-gray-900 shadow-sm"
                  : dm ? "text-gray-600 hover:text-gray-400" : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                {mode === "list" ? <List size={15} /> : <LayoutGrid size={15} />}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className={`p-5 rounded-xl border mb-6 space-y-4 ${dm ? "bg-gray-900 border-white/5" : "bg-gray-50 border-gray-200"}`}>
                {/* Categories */}
                <div>
                  <p className={`text-xs font-medium mb-3 ${dm ? "text-gray-400" : "text-gray-500"}`}>分类</p>
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map((cat) => (
                      <motion.button
                        key={cat}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selectedCategory === cat
                          ? dm ? "bg-indigo-500 text-white" : "bg-indigo-600 text-white"
                          : dm ? "bg-white/5 text-gray-400 hover:bg-white/10" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                      >
                        {cat}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <p className={`text-xs font-medium mb-3 ${dm ? "text-gray-400" : "text-gray-500"}`}>标签</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <motion.button
                        key={tag}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selectedTags.includes(tag)
                          ? dm ? "bg-violet-500/30 text-violet-300 border border-violet-500/30" : "bg-violet-50 text-violet-700 border border-violet-200"
                          : dm ? "bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                      >
                        # {tag}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {hasFilters && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={clearFilters}
                    className={`text-sm flex items-center gap-1.5 ${dm ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"} transition-colors`}
                  >
                    <X size={13} /> 清除所有筛选
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category pills (quick filter) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex gap-2 flex-wrap mb-8"
        >
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-sm transition-all ${!selectedCategory
              ? dm ? "bg-white text-gray-900" : "bg-gray-900 text-white"
              : dm ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-700"
              }`}
          >
            全部
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`px-3 py-1.5 rounded-full text-sm transition-all ${selectedCategory === cat
                ? dm ? "bg-indigo-500 text-white" : "bg-indigo-600 text-white"
                : dm ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-700"
                }`}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Results */}
        {loading ? (
          <div className={`py-20 text-center ${dm ? "text-gray-500" : "text-gray-400"}`}>
            正在加载文章...
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {filtered.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`text-center py-20 ${dm ? "text-gray-500" : "text-gray-400"}`}
              >
                <Search size={40} className="mx-auto mb-4 opacity-30" />
                <p>没有找到匹配的文章</p>
                <button onClick={clearFilters} className={`mt-4 text-sm underline ${dm ? "text-indigo-400" : "text-indigo-600"}`}>
                  清除筛选
                </button>
              </motion.div>
            ) : viewMode === "list" ? (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {filtered.map((post, i) => (
                  <PostCard key={post.id} post={post} darkMode={dm} index={i} variant="default" />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-5"
              >
                {filtered.map((post, i) => (
                  <PostCard key={post.id} post={post} darkMode={dm} index={i} variant="featured" />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
