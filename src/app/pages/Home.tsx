import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { motion, useScroll, useTransform, AnimatePresence } from "motion/react";
import { ArrowRight, Sparkles, Rss } from "lucide-react";
import { listArticles } from "../content/repository";
import type { Post } from "../data/posts";
import { demos } from "../data/demos";
import { PostCard } from "../components/PostCard";

const TAGLINE_WORDS = ["思考", "探索", "创造", "记录", "分享"];

interface HomeProps {
  darkMode: boolean;
}

// 打字机效果组件
function TypewriterTagline({ dm }: { dm: boolean }) {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState<"typing" | "pause" | "erasing">("typing");

  useEffect(() => {
    const word = TAGLINE_WORDS[index];
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (displayed.length < word.length) {
        timeout = setTimeout(() => setDisplayed(word.slice(0, displayed.length + 1)), 120);
      } else {
        timeout = setTimeout(() => setPhase("pause"), 1400);
      }
    } else if (phase === "pause") {
      timeout = setTimeout(() => setPhase("erasing"), 500);
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 70);
      } else {
        setIndex((i) => (i + 1) % TAGLINE_WORDS.length);
        setPhase("typing");
      }
    }
    return () => clearTimeout(timeout);
  }, [displayed, phase, index]);

  return (
    <span className={`inline-block min-w-[4ch] ${dm ? "text-indigo-400" : "text-indigo-600"}`}>
      {displayed}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
        className="inline-block w-0.5 h-[1em] ml-0.5 align-middle bg-current"
      />
    </span>
  );
}

export function Home({ darkMode }: HomeProps) {
  const dm = darkMode;
  const [posts, setPosts] = useState<Post[]>([]);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

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

  const featuredPosts = posts.filter((p) => p.featured);
  const recentPosts = posts.slice(0, 5);
  const articleCount = posts.length;
  const categoryCount = new Set(posts.map((post) => post.category)).size;
  const demoCount = demos.length;

  return (
    <div className={`min-h-screen ${dm ? "bg-gray-950" : "bg-white"}`}>
      {/* Hero */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
        {/* 背景网格层 */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(${dm ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"} 1px, transparent 1px), linear-gradient(90deg, ${dm ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"} 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* 渐变球体（装饰） */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 ${dm ? "bg-indigo-600" : "bg-indigo-400"}`}
          />
          <motion.div
            animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className={`absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-15 ${dm ? "bg-violet-600" : "bg-violet-400"}`}
          />
        </div>

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-16"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2 mb-8"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Sparkles size={16} className={dm ? "text-indigo-400" : "text-indigo-600"} />
            </motion.div>
            <span className={`text-sm font-medium ${dm ? "text-indigo-400" : "text-indigo-600"}`}>
              欢迎来到我的数字花园
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className={`text-5xl md:text-7xl font-light leading-tight mb-6 tracking-tight ${dm ? "text-white" : "text-gray-900"}`}
          >
            在这里
            <br />
            <TypewriterTagline dm={dm} />
            <br />
            关于生活与技术
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className={`text-lg max-w-xl leading-relaxed mb-10 ${dm ? "text-gray-400" : "text-gray-500"}`}
          >
            我是Octopus。这里记录我对技术、设计和生活的思考与探索。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center gap-4"
          >
            <Link to="/blog">
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${dm
                  ? "bg-white text-gray-900 hover:bg-gray-100"
                  : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
              >
                阅读文章
                <ArrowRight size={16} />
              </motion.button>
            </Link>
            <Link to="/about">
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium border transition-all ${dm
                  ? "border-white/10 text-gray-300 hover:border-white/20 hover:text-white"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900"
                  }`}
              >
                关于我
              </motion.button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex items-center gap-8 mt-16"
          >
            {[
              { value: articleCount, label: "篇文章" },
              { value: categoryCount, label: "个分类" },
              { value: demoCount, label: "个技术实验" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className={`text-2xl font-semibold ${dm ? "text-white" : "text-gray-900"}`}>
                  {stat.value}
                </div>
                <div className={`text-sm ${dm ? "text-gray-500" : "text-gray-400"}`}>{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className={`w-5 h-8 rounded-full border-2 flex items-start justify-center pt-1.5 ${dm ? "border-gray-600" : "border-gray-300"}`}
          >
            <div className={`w-1 h-2 rounded-full ${dm ? "bg-gray-500" : "bg-gray-400"}`} />
          </motion.div>
        </motion.div>
      </section>

      {/* Featured posts */}
      <section className={`py-20 ${dm ? "bg-gray-950" : "bg-gray-50/50"}`}>
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center justify-between mb-10"
          >
            <div>
              <div className={`flex items-center gap-2 text-sm font-medium mb-1 ${dm ? "text-indigo-400" : "text-indigo-600"}`}>
                <Rss size={14} />
                精选文章
              </div>
              <h2 className={`text-3xl font-light ${dm ? "text-white" : "text-gray-900"}`}>近期写作</h2>
            </div>
            <Link to="/blog">
              <motion.button
                whileHover={{ x: 4 }}
                className={`flex items-center gap-1.5 text-sm font-medium ${dm ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"} transition-colors`}
              >
                查看全部 <ArrowRight size={14} />
              </motion.button>
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {featuredPosts.map((post, i) => (
              <PostCard key={post.id} post={post} darkMode={dm} index={i} variant="featured" />
            ))}
          </div>

          <div className="space-y-2">
            {recentPosts.filter(p => !p.featured).slice(0, 3).map((post, i) => (
              <PostCard key={post.id} post={post} darkMode={dm} index={i} variant="compact" />
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter section */}
      {/* <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`relative overflow-hidden rounded-3xl p-10 md:p-14 ${dm
              ? "bg-gradient-to-br from-indigo-900/50 to-violet-900/30 border border-indigo-500/20"
              : "bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100"
              }`}
          >
            <div className="absolute top-0 right-0 w-64 h-64 opacity-20">
              <div className={`w-full h-full rounded-full blur-3xl ${dm ? "bg-indigo-500" : "bg-indigo-400"}`} />
            </div>
            <div className="relative z-10 max-w-xl">
              <h2 className={`text-3xl font-light mb-3 ${dm ? "text-white" : "text-gray-900"}`}>
                订阅新文章通知
              </h2>
              <p className={`mb-8 ${dm ? "text-gray-300" : "text-gray-600"}`}>
                每次更新文章时，我会发送邮件通知。不推送广告，只分享有价值的内容。
              </p>
              <NewsletterForm dm={dm} />
            </div>
          </motion.div>
        </div>
      </section> */}
    </div>
  );
}

function NewsletterForm({ dm }: { dm: boolean }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <AnimatePresence mode="wait">
      {submitted ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 text-sm ${dm ? "text-indigo-300" : "text-indigo-700"}`}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400 }}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${dm ? "bg-indigo-500" : "bg-indigo-600"} text-white`}
          >
            ✓
          </motion.div>
          <span>订阅成功！感谢你的关注，我会尽快与你联系。</span>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={handleSubmit}
          className="flex gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="输入你的邮箱地址"
            className={`flex-1 px-4 py-3 rounded-xl outline-none transition-all text-sm ${dm
              ? "bg-white/10 border border-white/10 text-white placeholder:text-gray-500 focus:border-indigo-400"
              : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 shadow-sm"
              }`}
          />
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            className={`px-5 py-3 rounded-xl font-medium text-sm whitespace-nowrap ${dm ? "bg-indigo-500 hover:bg-indigo-400 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
          >
            订阅
          </motion.button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
