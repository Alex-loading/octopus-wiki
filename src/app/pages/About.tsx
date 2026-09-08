import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Gamepad2, Code2, Camera, Car, ArrowRight, PlayingCardsFan, TentTree, Dog, Signature } from "lucide-react";
import { Link } from "react-router";
import { listArticles } from "../content/repository";
import type { Post } from "../data/posts";
import { PROFILE, SOCIAL_LINKS } from "../data/profile";
import { SocialIcon } from "../components/SocialIcon";

interface AboutProps {
  darkMode: boolean;
}

const SKILL_GROUPS = [
  { name: "前端基础", technologies: ["HTML", "CSS", "JavaScript", "TypeScript"] },
  { name: "框架与界面", technologies: ["Vue 3", "React", "Element Plus", "ECharts"] },
  { name: "全栈支持", technologies: ["Node.js", "Java", "Spring Boot", "SSE"] },
];

const INTERNSHIPS = [
  {
    period: "2026.04 - 2026.08",
    title: "字节跳动",
    role: "全栈 / 前端实习",
  },
  {
    period: "2025.07 - 2025.10",
    title: "美团",
    role: "AI 应用 / 前端实习",
  },
];

const EDUCATION = [
  { period: "2025.09 - 2027.06", title: "南京大学 · 软件工程硕士", desc: "硕士在读，2027 届毕业生" },
  { period: "2021.09 - 2025.06", title: "南京大学 · 软件工程本科", desc: "本科毕业后保研至南京大学" },
];

const INTERESTS = [
  { icon: Code2, label: "编程", position: "top-[7%] right-1 sm:-right-3", tilt: 5 },
  { icon: Gamepad2, label: "单机游戏", position: "top-[30%] -right-2 sm:-right-6", tilt: -4 },
  { icon: Car, label: "驾驶", position: "top-[52%] -right-1 sm:-right-2", tilt: 3 },
  { icon: PlayingCardsFan, label: "桌游", position: "top-[73%] right-2 sm:-right-5", tilt: -6 },
  { icon: TentTree, label: "旅行", position: "-bottom-2 right-0 sm:right-[10%]", tilt: -4 },
  { icon: Dog, label: "想养狗", position: "-bottom-4 left-[38%]", tilt: 4 },
  { icon: Signature, label: "INFJ", position: "-bottom-2 left-[6%] sm:left-[8%]", tilt: -5 },
];

export function About({ darkMode }: AboutProps) {
  const dm = darkMode;
  const [activeTab, setActiveTab] = useState<"about" | "work">("about");
  const [posts, setPosts] = useState<Post[]>([]);
  const recentPosts = posts.slice(0, 3);

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
              <span className={`font-medium ${dm ? "text-indigo-400" : "text-indigo-600"}`}>{PROFILE.name}</span>
            </h1>
            <p className={`leading-relaxed mb-6 ${dm ? "text-gray-400" : "text-gray-600"}`}>
              南京大学软件工程硕士在读，预计 2027 年毕业。
              关注偏前端的全栈开发与 AI 应用，希望把技术探索落到可用的产品里，希望做点有意思的事情。
            </p>
            <p className={`leading-relaxed mb-8 ${dm ? "text-gray-400" : "text-gray-600"}`}>
              这里各种各样的一些东西，还在不断填坑中！
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <motion.a
                href={`mailto:${PROFILE.email}`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${dm ? "bg-white text-gray-900 hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
              >
                <Mail size={14} />
                发送邮件
              </motion.a>
              {SOCIAL_LINKS.filter(({ label }) => label !== "邮件").map(({ href, icon, label }) => (
                <motion.a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  title={label}
                  aria-label={label}
                  className={`p-2.5 rounded-xl border transition-colors ${dm ? "border-white/10 text-gray-400 hover:text-white hover:border-white/20" : "border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300"
                    }`}
                >
                  <SocialIcon icon={icon} />
                </motion.a>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative mb-14"
          >
            <div className={`absolute inset-0 rounded-3xl blur-2xl opacity-20 ${dm ? "bg-indigo-600" : "bg-indigo-400"}`} />
            <div className="relative">
              <img
                src={PROFILE.portrait}
                alt={PROFILE.name}
                width={1254}
                height={1254}
                className="w-full aspect-square object-cover rounded-3xl"
              />
              {/* Interests floating badges */}
              {INTERESTS.map((item, i) => (
                <motion.div
                  key={item.label}
                  data-interest={item.label}
                  initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
                  animate={{ opacity: 1, scale: 1, rotate: item.tilt }}
                  transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 300 }}
                  className={`absolute ${item.position} flex items-center gap-2 px-3 py-2 rounded-full text-sm whitespace-nowrap backdrop-blur-sm border max-[359px]:gap-1.5 max-[359px]:px-2.5 max-[359px]:py-1.5 max-[359px]:text-xs ${dm ? "bg-gray-900/90 border-white/10 text-white" : "bg-white/90 border-gray-200 text-gray-900 shadow-sm"
                    }`}
                >
                  <item.icon size={14} className={`shrink-0 ${dm ? "text-indigo-400" : "text-indigo-600"}`} />
                  {item.label}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 p-1 rounded-xl mb-10 w-fit ${dm ? "bg-gray-900" : "bg-gray-100"}`}>
          {(["about", "work"] as const).map((tab) => {
            const labels = { about: "关于", work: "经历" };
            return (
              <motion.button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab
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
                <div className="space-y-6">
                  {SKILL_GROUPS.map((group, i) => (
                    <motion.section
                      key={group.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                    >
                      <h3 className="text-xs font-medium mb-3 text-gray-500">{group.name}</h3>
                      <ul aria-label={group.name} className="flex flex-wrap gap-2">
                        {group.technologies.map((technology) => (
                          <li
                            key={technology}
                            className={`rounded-lg px-3 py-1.5 text-sm whitespace-nowrap ${dm ? "bg-white/5 text-gray-300" : "bg-gray-100 text-gray-700"}`}
                          >
                            {technology}
                          </li>
                        ))}
                      </ul>
                    </motion.section>
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
                        className={`flex items-start gap-3 p-3 rounded-xl transition-colors group ${dm ? "hover:bg-white/5" : "hover:bg-gray-50"
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
              <h2 className={`text-xl font-medium mb-8 ${dm ? "text-white" : "text-gray-900"}`}>实习经历</h2>
              <div className={`border-l ml-1 pl-6 space-y-10 ${dm ? "border-white/10" : "border-gray-200"}`}>
                {INTERNSHIPS.map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="relative"
                  >
                    <div className={`absolute -left-[1.8rem] top-1.5 w-2 h-2 rounded-full ring-2 ${dm ? "bg-indigo-500 ring-gray-950" : "bg-indigo-600 ring-white"}`} />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <h3 className={`text-base font-medium ${dm ? "text-white" : "text-gray-900"}`}>{item.title}</h3>
                      <span className="text-xs font-mono shrink-0 text-gray-500">{item.period}</span>
                    </div>
                    <p className={`text-sm ${dm ? "text-indigo-400" : "text-indigo-600"}`}>{item.role}</p>
                  </motion.div>
                ))}
              </div>

              <section className="mt-12">
                <h2 className={`text-xl font-medium mb-8 ${dm ? "text-white" : "text-gray-900"}`}>教育经历</h2>
                <div className={`border-l ml-1 pl-6 space-y-10 ${dm ? "border-white/10" : "border-gray-200"}`}>
                  {EDUCATION.map((item) => (
                    <div key={item.title} className="relative">
                      <div aria-hidden="true" className={`absolute -left-[1.8rem] top-1.5 w-2 h-2 rounded-full ring-2 ${dm ? "bg-indigo-500 ring-gray-950" : "bg-indigo-600 ring-white"}`} />
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <h3 className={`text-base font-medium ${dm ? "text-white" : "text-gray-900"}`}>{item.title}</h3>
                        <span className="text-xs font-mono text-gray-500">{item.period}</span>
                      </div>
                      <p className={`text-sm ${dm ? "text-indigo-400" : "text-indigo-600"}`}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
