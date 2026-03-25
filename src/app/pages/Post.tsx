import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence, useScroll, useSpring } from "motion/react";
import {
  ArrowLeft,
  Clock,
  Heart,
  Bookmark,
  Share2,
  MessageCircle,
  ChevronRight,
  Send,
  Tag,
  List,
} from "lucide-react";
import { getArticleBySlug, listArticles } from "../content/repository";
import type { Post as PostItem } from "../data/posts";

interface PostProps {
  darkMode: boolean;
}

const MOCK_COMMENTS = [
  {
    id: 1,
    author: "张晓明",
    avatar: "Z",
    time: "2 天前",
    content: "写得很有共鸣，特别是关于注意力切换成本的部分，我也有同样的感受。",
  },
  {
    id: 2,
    author: "李思远",
    avatar: "L",
    time: "1 天前",
    content:
      "深度工作确实很难，但是一旦进入状态，那种专注的感觉真的很好。感谢分享！",
  },
  {
    id: 3,
    author: "王芳",
    avatar: "W",
    time: "5 小时前",
    content:
      "我最近也在尝试早起做深度工作，效果挺明显的，推荐给大家试试。",
  },
];

interface Heading {
  id: string;
  level: 2 | 3;
  text: string;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]/g, "");
}

function MarkdownRenderer({
  content,
  dm,
  headings,
}: {
  content: string;
  dm: boolean;
  headings: Heading[];
}) {
  const lines = content.trim().split("\n");
  let headingIndex = 0;

  const renderLine = (line: string, idx: number) => {
    if (line.startsWith("## ")) {
      const text = line.slice(3);
      const id = headings[headingIndex]?.id ?? slugify(text);
      headingIndex++;
      return (
        <h2
          key={idx}
          id={id}
          className={`text-xl font-medium mt-10 mb-4 scroll-mt-28 ${dm ? "text-white" : "text-gray-900"
            }`}
        >
          {text}
        </h2>
      );
    }
    if (line.startsWith("### ")) {
      const text = line.slice(4);
      const id = headings[headingIndex]?.id ?? slugify(text);
      headingIndex++;
      return (
        <h3
          key={idx}
          id={id}
          className={`text-base font-medium mt-6 mb-3 scroll-mt-28 ${dm ? "text-white" : "text-gray-900"
            }`}
        >
          {text}
        </h3>
      );
    }
    if (line.startsWith("- ")) {
      return (
        <li
          key={idx}
          className={`ml-5 my-1.5 ${dm ? "text-gray-300" : "text-gray-600"}`}
        >
          {line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}
        </li>
      );
    }
    if (line.startsWith("```")) {
      return null;
    }
    if (line.trim() === "") return <div key={idx} className="my-2" />;
    return (
      <p
        key={idx}
        className={`my-3 leading-relaxed ${dm ? "text-gray-300" : "text-gray-600"
          }`}
        dangerouslySetInnerHTML={{
          __html: line
            .replace(
              /\*\*(.*?)\*\*/g,
              `<strong class="${dm ? "text-white" : "text-gray-900"
              } font-medium">$1</strong>`
            )
            .replace(
              /`(.*?)`/g,
              `<code class="px-1.5 py-0.5 rounded text-sm font-mono ${dm
                ? "bg-white/10 text-indigo-300"
                : "bg-gray-100 text-indigo-700"
              }">$1</code>`
            ),
        }}
      />
    );
  };

  return <div className="text-base">{lines.map(renderLine)}</div>;
}

function TableOfContents({
  headings,
  activeId,
  dm,
  onItemClick,
}: {
  headings: Heading[];
  activeId: string;
  dm: boolean;
  onItemClick?: () => void;
}) {
  if (headings.length === 0) return null;

  return (
    <nav className="space-y-1">
      <p
        className={`text-xs font-medium mb-3 flex items-center gap-1.5 ${dm ? "text-gray-500" : "text-gray-400"
          }`}
      >
        <List size={12} />
        目录
      </p>
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(h.id)?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
            onItemClick?.();
          }}
          className={`block text-xs leading-relaxed transition-all duration-200 ${h.level === 3 ? "pl-3" : ""
            } ${activeId === h.id
              ? dm
                ? "text-indigo-400 font-medium"
                : "text-indigo-600 font-medium"
              : dm
                ? "text-gray-600 hover:text-gray-300"
                : "text-gray-400 hover:text-gray-700"
            }`}
        >
          <span
            className={`inline-block transition-all duration-200 ${activeId === h.id ? "translate-x-1" : ""
              }`}
          >
            {h.text}
          </span>
        </a>
      ))}
    </nav>
  );
}

export function Post({ darkMode }: PostProps) {
  const location = useLocation();
  const slug = location.pathname.replace("/post/", "");
  const navigate = useNavigate();
  const dm = darkMode;

  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likeCount] = useState(Math.floor(Math.random() * 80) + 20);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(MOCK_COMMENTS);
  const [copied, setCopied] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState("");
  const [showToc, setShowToc] = useState(false);
  const [post, setPost] = useState<PostItem | null>(null);
  const [allArticles, setAllArticles] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });

  const relatedPosts = useMemo(() => {
    if (!post) return [];
    return allArticles
      .filter((item) => item.id !== post.id && item.category === post.category)
      .slice(0, 2);
  }, [allArticles, post]);

  // Extract headings from content
  const headings: Heading[] = useMemo(() => {
    if (!post) return [];
    const lines = post.content.trim().split("\n");
    const result: Heading[] = [];
    const counts: Record<string, number> = {};
    for (const line of lines) {
      if (line.startsWith("## ") || line.startsWith("### ")) {
        const text = line.startsWith("### ") ? line.slice(4) : line.slice(3);
        const level = line.startsWith("### ") ? 3 : 2;
        const baseId = slugify(text);
        counts[baseId] = (counts[baseId] ?? 0) + 1;
        const id = counts[baseId] > 1 ? `${baseId}-${counts[baseId]}` : baseId;
        result.push({ id, level: level as 2 | 3, text });
      }
    }
    return result;
  }, [post]);

  // Scroll spy for TOC active heading
  const handleScroll = useCallback(() => {
    if (headings.length === 0) return;
    const scrollY = window.scrollY + 140;
    let current = headings[0]?.id ?? "";
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el && el.offsetTop <= scrollY) {
        current = h.id;
      }
    }
    setActiveHeadingId(current);
  }, [headings]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    Promise.all([getArticleBySlug(slug), listArticles()])
      .then(([detail, list]) => {
        if (cancelled) return;
        setPost(detail);
        setAllArticles(list);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setComments([
      ...comments,
      {
        id: Date.now(),
        author: "你",
        avatar: "你",
        time: "刚刚",
        content: comment,
      },
    ]);
    setComment("");
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${dm ? "bg-gray-950 text-gray-300" : "bg-white text-gray-500"
          }`}
      >
        正在加载文章...
      </div>
    );
  }

  if (!post) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${dm ? "bg-gray-950 text-white" : "bg-white text-gray-900"
          }`}
      >
        <div className="text-center">
          <p className="text-lg mb-4">文章不存在</p>
          <Link
            to="/blog"
            className={`text-sm ${dm ? "text-indigo-400" : "text-indigo-600"
              } underline`}
          >
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dm ? "bg-gray-950" : "bg-white"}`}>
      {/* Reading progress bar */}
      <motion.div
        style={{ scaleX }}
        className="fixed top-0 left-0 right-0 h-0.5 bg-indigo-500 origin-left z-[200]"
      />

      {/* Back button */}
      <div className="fixed top-20 left-6 z-40">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.05, x: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm backdrop-blur-sm transition-colors ${dm
              ? "bg-gray-900/80 border border-white/10 text-gray-400 hover:text-white"
              : "bg-white/80 border border-gray-200 text-gray-500 hover:text-gray-900 shadow-sm"
            }`}
        >
          <ArrowLeft size={14} />
          返回
        </motion.button>
      </div>

      {/* Mobile TOC toggle */}
      {headings.length > 0 && (
        <div className="fixed top-20 right-6 z-40 xl:hidden">
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowToc(!showToc)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm backdrop-blur-sm transition-colors ${showToc
                ? dm
                  ? "bg-indigo-500/20 border border-indigo-500/30 text-indigo-400"
                  : "bg-indigo-50 border border-indigo-200 text-indigo-600"
                : dm
                  ? "bg-gray-900/80 border border-white/10 text-gray-400 hover:text-white"
                  : "bg-white/80 border border-gray-200 text-gray-500 hover:text-gray-900 shadow-sm"
              }`}
          >
            <List size={14} />
            目录
          </motion.button>
        </div>
      )}

      {/* Mobile TOC dropdown */}
      <AnimatePresence>
        {showToc && headings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`fixed top-[72px] right-6 z-40 xl:hidden w-52 rounded-xl border p-4 shadow-xl ${dm
                ? "bg-gray-900 border-white/10"
                : "bg-white border-gray-200 shadow-gray-200/50"
              }`}
          >
            <TableOfContents
              headings={headings}
              activeId={activeHeadingId}
              dm={dm}
              onItemClick={() => setShowToc(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero image */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative h-[45vh] overflow-hidden"
      >
        <motion.img
          src={post.coverImage}
          alt={post.title}
          className="w-full h-full object-cover"
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
        <div
          className={`absolute inset-0 ${dm
              ? "bg-gradient-to-b from-gray-950/30 to-gray-950"
              : "bg-gradient-to-b from-black/10 to-white"
            }`}
        />
      </motion.div>

      {/* Content layout with optional TOC */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="flex gap-12">
          {/* Main content */}
          <div className="flex-1 min-w-0 max-w-2xl">
            {/* Meta */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="-mt-16 relative z-10 mb-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${dm
                      ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/20"
                      : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                    }`}
                >
                  <Tag size={10} />
                  {post.category}
                </span>
              </div>
              <h1
                className={`text-3xl md:text-4xl font-light leading-tight mb-4 ${dm ? "text-white" : "text-gray-900"
                  }`}
              >
                {post.title}
              </h1>
              <p
                className={`text-lg leading-relaxed mb-6 ${dm ? "text-gray-400" : "text-gray-500"
                  }`}
              >
                {post.excerpt}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${dm
                        ? "bg-indigo-500 text-white"
                        : "bg-indigo-600 text-white"
                      }`}
                  >
                    陈
                  </div>
                  <div>
                    <p
                      className={`text-sm font-medium ${dm ? "text-white" : "text-gray-900"
                        }`}
                    >
                      陈默
                    </p>
                    <div
                      className={`flex items-center gap-2 text-xs ${dm ? "text-gray-500" : "text-gray-400"
                        }`}
                    >
                      <span>{post.date}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {post.readTime} 分钟阅读
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {copied && (
                      <motion.span
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`text-xs ${dm ? "text-green-400" : "text-green-600"
                          }`}
                      >
                        已复制链接
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleShare}
                    className={`p-2 rounded-lg transition-colors ${dm
                        ? "hover:bg-white/5 text-gray-500"
                        : "hover:bg-gray-100 text-gray-400"
                      }`}
                  >
                    <Share2 size={16} />
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Divider */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.3 }}
              className={`h-px mb-10 origin-left ${dm ? "bg-white/5" : "bg-gray-100"
                }`}
            />

            {/* Article content */}
            <motion.div
              ref={contentRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <MarkdownRenderer
                content={post.content}
                dm={dm}
                headings={headings}
              />
            </motion.div>

            {/* Tags */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap gap-2 mt-10"
            >
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className={`text-sm px-3 py-1.5 rounded-lg ${dm
                      ? "bg-white/5 text-gray-400"
                      : "bg-gray-100 text-gray-600"
                    }`}
                >
                  # {tag}
                </span>
              ))}
            </motion.div>

            {/* Reaction bar */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={`flex items-center justify-between mt-10 p-5 rounded-2xl border ${dm ? "bg-gray-900 border-white/5" : "bg-gray-50 border-gray-100"
                }`}
            >
              <p
                className={`text-sm ${dm ? "text-gray-400" : "text-gray-500"
                  }`}
              >
                如果这篇文章对你有帮助，请点赞支持 😊
              </p>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setLiked(!liked)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${liked
                      ? "bg-rose-500 text-white"
                      : dm
                        ? "bg-white/5 text-gray-400 hover:bg-white/10"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
                    }`}
                >
                  <motion.div
                    animate={{ scale: liked ? [1, 1.5, 1] : 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Heart size={14} fill={liked ? "currentColor" : "none"} />
                  </motion.div>
                  {likeCount + (liked ? 1 : 0)}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setBookmarked(!bookmarked)}
                  className={`p-2 rounded-xl transition-all ${bookmarked
                      ? dm
                        ? "bg-indigo-500/20 text-indigo-400"
                        : "bg-indigo-50 text-indigo-600"
                      : dm
                        ? "bg-white/5 text-gray-400 hover:bg-white/10"
                        : "bg-white text-gray-500 border border-gray-200"
                    }`}
                >
                  <Bookmark
                    size={16}
                    fill={bookmarked ? "currentColor" : "none"}
                  />
                </motion.button>
              </div>
            </motion.div>

            {/* Related posts */}
            {relatedPosts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-14"
              >
                <h3
                  className={`text-lg font-medium mb-5 ${dm ? "text-white" : "text-gray-900"
                    }`}
                >
                  相关文章
                </h3>
                <div className="space-y-3">
                  {relatedPosts.map((rp) => (
                    <Link
                      key={rp.id}
                      to={`/post/${rp.slug}`}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all group ${dm
                          ? "border-white/5 hover:border-white/10 bg-gray-900/50"
                          : "border-gray-100 hover:border-gray-200 bg-gray-50/50"
                        }`}
                    >
                      <img
                        src={rp.coverImage}
                        alt={rp.title}
                        className="w-14 h-12 object-cover rounded-lg shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium line-clamp-1 group-hover:text-indigo-500 transition-colors ${dm ? "text-white" : "text-gray-900"
                            }`}
                        >
                          {rp.title}
                        </p>
                        <p
                          className={`text-xs mt-0.5 flex items-center gap-1 ${dm ? "text-gray-500" : "text-gray-400"
                            }`}
                        >
                          <Clock size={10} /> {rp.readTime} 分钟
                        </p>
                      </div>
                      <ChevronRight
                        size={14}
                        className={`shrink-0 transition-transform group-hover:translate-x-1 ${dm ? "text-gray-600" : "text-gray-300"
                          }`}
                      />
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Comments */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-14"
            >
              <h3
                className={`text-lg font-medium mb-6 flex items-center gap-2 ${dm ? "text-white" : "text-gray-900"
                  }`}
              >
                <MessageCircle size={18} />
                评论 ({comments.length})
              </h3>

              {/* Comment input */}
              <form onSubmit={handleComment} className="mb-8">
                <div
                  className={`flex gap-3 p-4 rounded-2xl border ${dm
                      ? "bg-gray-900 border-white/5"
                      : "bg-gray-50 border-gray-100"
                    }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-medium ${dm
                        ? "bg-indigo-500 text-white"
                        : "bg-indigo-600 text-white"
                      }`}
                  >
                    你
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="写下你的想法..."
                      rows={3}
                      className={`w-full bg-transparent outline-none resize-none text-sm placeholder:text-gray-500 ${dm ? "text-white" : "text-gray-900"
                        }`}
                    />
                    <div className="flex justify-end mt-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        type="submit"
                        disabled={!comment.trim()}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${comment.trim()
                            ? dm
                              ? "bg-indigo-500 text-white hover:bg-indigo-400"
                              : "bg-indigo-600 text-white hover:bg-indigo-700"
                            : dm
                              ? "bg-white/5 text-gray-600 cursor-not-allowed"
                              : "bg-gray-200 text-gray-400 cursor-not-allowed"
                          }`}
                      >
                        <Send size={12} />
                        发布
                      </motion.button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Comment list */}
              <div className="space-y-5">
                <AnimatePresence>
                  {comments.map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex gap-3"
                    >
                      <div
                        className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-medium ${c.author === "你"
                            ? dm
                              ? "bg-indigo-500 text-white"
                              : "bg-indigo-600 text-white"
                            : dm
                              ? "bg-white/10 text-gray-300"
                              : "bg-gray-200 text-gray-600"
                          }`}
                      >
                        {c.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-sm font-medium ${dm ? "text-white" : "text-gray-900"
                              }`}
                          >
                            {c.author}
                          </span>
                          <span
                            className={`text-xs ${dm ? "text-gray-600" : "text-gray-400"
                              }`}
                          >
                            {c.time}
                          </span>
                        </div>
                        <p
                          className={`text-sm leading-relaxed ${dm ? "text-gray-400" : "text-gray-600"
                            }`}
                        >
                          {c.content}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* Desktop TOC sidebar */}
          {headings.length > 0 && (
            <motion.aside
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="hidden xl:block w-48 shrink-0"
            >
              <div className="sticky top-28">
                <TableOfContents
                  headings={headings}
                  activeId={activeHeadingId}
                  dm={dm}
                />

                {/* Progress indicator */}
                <div className="mt-8">
                  <div
                    className={`flex items-center justify-between text-xs mb-2 ${dm ? "text-gray-600" : "text-gray-400"
                      }`}
                  >
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      阅读时间
                    </span>
                    <span>{post.readTime} 分钟</span>
                  </div>
                  <div
                    className={`h-1 rounded-full overflow-hidden ${dm ? "bg-white/5" : "bg-gray-100"
                      }`}
                  >
                    <motion.div
                      style={{ scaleX, transformOrigin: "left" }}
                      className="h-full bg-indigo-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </div>
      </div>
    </div>
  );
}
