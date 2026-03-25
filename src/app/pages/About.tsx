import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Github, Twitter, ExternalLink, BookOpen, Code2, Camera, Coffee, Rss, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { posts } from "../data/posts";

interface AboutProps {
  darkMode: boolean;
}

const SKILLS = [
  { name: "TypeScript", level: 90 },
  { name: "React", level: 88 },
  { name: "Node.js", level: 75 },
  { name: "设计思维", level: 70 },
  { name: "写作", level: 85 },
];

const TIMELINE = [
  { year: "2026", title: "独立开发者", desc: "全职独立开发，同时坚持写作和探索。" },
  { year: "2024", title: "创业公司 CTO", desc: "带领 8 人工程团队，从 0 到 1 构建 SaaS 产品。" },
  { year: "2022", title: "高级前端工程师", desc: "在互联网公司负责用户端产品研发，服务千万级用户。" },
  { year: "2020", title: "开始写作", desc: "开始在技术社区写文章，意外收获了第一批读者。" },
  { year: "2018", title: "踏入行业", desc: "计算机科学毕业，加入第一家公司，写下第一行生产代码。" },
];

const INTERESTS = [
  { icon: Code2, label: "编程" },
  { icon: BookOpen, label: "阅读" },
  { icon: Camera, label: "摄影" },
  { icon: Coffee, label: "咖啡" },
];

export function About({ darkMode }: AboutProps) {
  const dm = darkMode;
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"about" | "work" | "contact">("about");
  const recentPosts = posts.slice(0, 3);

  return (
    <div className={`min-h-screen pt-24 pb-20 ${dm ? "bg-gray-950" : "bg-white"}`}>
      <div className="max-w-5xl mx-auto px-6">

        {/* Hero section */}
        <div className="grid md:grid-cols-2 gap-12 mb-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className={`text-sm font-medium mb-3 ${dm ? "text-indigo-400" : "text-indigo-600"}`}>
              关于我
            </p>
            <h1 className={`text-4xl font-light tracking-tight mb-5 ${dm ? "text-white" : "text-gray-900"}`}>
              你好，我是<br />
              <span className={`font-medium ${dm ? "text-indigo-400" : "text-indigo-600"}`}>陈默</span>
            </h1>
            <p className={`leading-relaxed mb-6 ${dm ? "text-gray-400" : "text-gray-600"}`}>
              独立开发者 · 写作者 · 极简主义爱好者。
              我在这里记录对技术、设计、生活的思考，试图在嘈杂的世界里找到值得认真对待的事情。
            </p>
            <p className={`leading-relaxed mb-8 ${dm ? "text-gray-400" : "text-gray-600"}`}>
              相信"少即是多"，热爱简单而深入的事物。
              正在探索个人写作与独立产品的边界。
            </p>

            <div className="flex items-center gap-3">
              <motion.a
                href="mailto:hello@chenmo.dev"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
                  dm ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                <Mail size={14} />
                发送邮件
              </motion.a>
              {[
                { href: "#", icon: Github, label: "GitHub" },
                { href: "#", icon: Twitter, label: "Twitter" },
                { href: "#", icon: Rss, label: "RSS" },
              ].map(({ href, icon: Icon, label }) => (
                <motion.a
                  key={label}
                  href={href}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  title={label}
                  className={`p-2.5 rounded-xl border transition-colors ${
                    dm ? "border-white/10 text-gray-400 hover:text-white hover:border-white/20" : "border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300"
                  }`}
                >
                  <Icon size={16} />
                </motion.a>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className={`absolute inset-0 rounded-3xl blur-2xl opacity-20 ${dm ? "bg-indigo-600" : "bg-indigo-400"}`} />
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1625850902501-cc6baef3e3b2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXZlbG9wZXIlMjBwb3J0cmFpdCUyMHlvdW5nJTIwYXNpYW4lMjBtYW58ZW58MXx8fHwxNzczOTE4MjY2fDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="陈默"
                className="w-full aspect-square object-cover rounded-3xl"
              />
              {/* Interests floating badges */}
              {INTERESTS.map((item, i) => {
                const positions = [
                  "top-4 -right-4",
                  "top-1/3 -right-6",
                  "-bottom-4 right-12",
                  "-bottom-4 left-8",
                ];
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 300 }}
                    className={`absolute ${positions[i]} flex items-center gap-2 px-3 py-2 rounded-xl text-sm backdrop-blur-sm border ${
                      dm ? "bg-gray-900/90 border-white/10 text-white" : "bg-white/90 border-gray-200 text-gray-900 shadow-sm"
                    }`}
                  >
                    <item.icon size={14} className={dm ? "text-indigo-400" : "text-indigo-600"} />
                    {item.label}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 p-1 rounded-xl mb-10 w-fit ${dm ? "bg-gray-900" : "bg-gray-100"}`}>
          {(["about", "work", "contact"] as const).map((tab) => {
            const labels = { about: "关于", work: "经历", contact: "联系" };
            return (
              <motion.button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? dm ? "text-white" : "text-gray-900"
                    : dm ? "text-gray-500 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="about-tab"
                    className={`absolute inset-0 rounded-lg ${dm ? "bg-white/10" : "bg-white shadow-sm"}`}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{labels[tab]}</span>
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "about" && (
            <motion.div
              key="about"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="grid md:grid-cols-2 gap-10"
            >
              {/* Skills */}
              <div>
                <h2 className={`text-xl font-medium mb-6 ${dm ? "text-white" : "text-gray-900"}`}>技能</h2>
                <div className="space-y-4">
                  {SKILLS.map((skill, i) => (
                    <motion.div
                      key={skill.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      onHoverStart={() => setHoveredSkill(skill.name)}
                      onHoverEnd={() => setHoveredSkill(null)}
                    >
                      <div className="flex justify-between mb-1.5">
                        <span className={`text-sm ${dm ? "text-gray-300" : "text-gray-700"}`}>{skill.name}</span>
                        <motion.span
                          animate={{ opacity: hoveredSkill === skill.name ? 1 : 0 }}
                          className={`text-xs ${dm ? "text-indigo-400" : "text-indigo-600"}`}
                        >
                          {skill.level}%
                        </motion.span>
                      </div>
                      <div className={`h-1.5 rounded-full overflow-hidden ${dm ? "bg-white/5" : "bg-gray-100"}`}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${skill.level}%` }}
                          transition={{ duration: 0.8, delay: 0.3 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                          className={`h-full rounded-full ${
                            hoveredSkill === skill.name
                              ? "bg-indigo-500"
                              : dm ? "bg-white/30" : "bg-gray-400"
                          } transition-colors`}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Latest posts */}
              <div>
                <h2 className={`text-xl font-medium mb-6 ${dm ? "text-white" : "text-gray-900"}`}>最新文章</h2>
                <div className="space-y-3">
                  {recentPosts.map((post, i) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                    >
                      <Link
                        to={`/post/${post.slug}`}
                        className={`flex items-start gap-3 p-3 rounded-xl transition-colors group ${
                          dm ? "hover:bg-white/5" : "hover:bg-gray-50"
                        }`}
                      >
                        <img src={post.coverImage} alt={post.title} className="w-12 h-10 object-cover rounded-lg shrink-0" />
                        <div>
                          <p className={`text-sm font-medium line-clamp-1 group-hover:text-indigo-500 transition-colors ${dm ? "text-white" : "text-gray-900"}`}>
                            {post.title}
                          </p>
                          <p className={`text-xs mt-0.5 ${dm ? "text-gray-500" : "text-gray-400"}`}>{post.date}</p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                  <Link to="/blog">
                    <motion.button
                      whileHover={{ x: 4 }}
                      className={`flex items-center gap-1.5 text-sm mt-2 px-3 ${dm ? "text-gray-500 hover:text-white" : "text-gray-400 hover:text-gray-900"} transition-colors`}
                    >
                      查看全部文章 <ArrowRight size={13} />
                    </motion.button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "work" && (
            <motion.div
              key="work"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className={`text-xl font-medium mb-8 ${dm ? "text-white" : "text-gray-900"}`}>时间线</h2>
              <div className="relative">
                {/* Timeline line */}
                <div className={`absolute left-[4.5rem] top-0 bottom-0 w-px ${dm ? "bg-white/10" : "bg-gray-100"}`} />

                <div className="space-y-8">
                  {TIMELINE.map((item, i) => (
                    <motion.div
                      key={item.year}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex gap-6 items-start"
                    >
                      <div className={`shrink-0 text-sm font-mono w-16 text-right pt-0.5 ${dm ? "text-gray-500" : "text-gray-400"}`}>
                        {item.year}
                      </div>
                      <div className="relative">
                        <div className={`absolute -left-[1.65rem] top-1.5 w-2 h-2 rounded-full ring-2 ${dm ? "bg-indigo-500 ring-gray-950" : "bg-indigo-600 ring-white"}`} />
                      </div>
                      <div className={`flex-1 pb-8 ${i < TIMELINE.length - 1 ? "" : ""}`}>
                        <h3 className={`text-base font-medium mb-1 ${dm ? "text-white" : "text-gray-900"}`}>
                          {item.title}
                        </h3>
                        <p className={`text-sm leading-relaxed ${dm ? "text-gray-400" : "text-gray-600"}`}>
                          {item.desc}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "contact" && (
            <motion.div
              key="contact"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="max-w-lg"
            >
              <h2 className={`text-xl font-medium mb-3 ${dm ? "text-white" : "text-gray-900"}`}>联系我</h2>
              <p className={`mb-8 ${dm ? "text-gray-400" : "text-gray-500"}`}>
                有任何想法、问题或合作意向，欢迎随时联系我。通常会在 24 小时内回复。
              </p>

              <ContactForm dm={dm} />

              <div className={`mt-8 pt-8 border-t ${dm ? "border-white/5" : "border-gray-100"}`}>
                <p className={`text-sm mb-4 ${dm ? "text-gray-500" : "text-gray-400"}`}>也可以在这里找到我</p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { icon: Mail, label: "Email", value: "hello@chenmo.dev" },
                    { icon: Github, label: "GitHub", value: "@chenmo-dev" },
                    { icon: Twitter, label: "Twitter", value: "@chenmo" },
                  ].map((item) => (
                    <a
                      key={item.label}
                      href="#"
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm transition-all group ${
                        dm ? "border-white/5 hover:border-white/15 text-gray-400 hover:text-white" : "border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <item.icon size={14} />
                      <span>{item.value}</span>
                      <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ContactForm({ dm }: { dm: boolean }) {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name && form.email && form.message) setSent(true);
  };

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`p-6 rounded-2xl text-center border ${dm ? "border-green-500/20 bg-green-500/5" : "border-green-200 bg-green-50"}`}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
          className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-xl ${dm ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-600"}`}
        >
          ✓
        </motion.div>
        <p className={`font-medium mb-1 ${dm ? "text-white" : "text-gray-900"}`}>消息已发送！</p>
        <p className={`text-sm ${dm ? "text-gray-400" : "text-gray-500"}`}>感谢你的来信，我会尽快回复。</p>
      </motion.div>
    );
  }

  const inputClass = `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
    dm
      ? "bg-gray-900 border-white/5 text-white placeholder:text-gray-600 focus:border-indigo-500/50"
      : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-indigo-300 focus:bg-white"
  }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={`text-xs mb-1.5 block ${dm ? "text-gray-400" : "text-gray-500"}`}>姓名</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="你的名字"
            className={inputClass}
          />
        </div>
        <div>
          <label className={`text-xs mb-1.5 block ${dm ? "text-gray-400" : "text-gray-500"}`}>邮箱</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="your@email.com"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className={`text-xs mb-1.5 block ${dm ? "text-gray-400" : "text-gray-500"}`}>消息</label>
        <textarea
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="写下你想说的..."
          rows={4}
          className={`${inputClass} resize-none`}
        />
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        type="submit"
        className={`w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${
          dm ? "bg-indigo-500 hover:bg-indigo-400 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"
        }`}
      >
        <Mail size={14} />
        发送消息
      </motion.button>
    </form>
  );
}
