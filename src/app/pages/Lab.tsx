import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FlaskConical,
  ExternalLink,
  X,
  Sparkles,
  Clock,
  Layers,
  ChevronRight,
  Zap,
} from "lucide-react";
import { demos, demoCategories, Demo } from "../data/demos";

interface LabProps {
  darkMode: boolean;
}

function StatusBadge({ status }: { status: Demo["status"] }) {
  const configs = {
    live: {
      label: "运行中",
      dot: "bg-emerald-400",
      badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
      pulse: true,
    },
    wip: {
      label: "开发中",
      dot: "bg-amber-400",
      badge: "bg-amber-500/15 text-amber-400 border-amber-500/25",
      pulse: false,
    },
    planned: {
      label: "计划中",
      dot: "bg-gray-500",
      badge: "bg-gray-500/15 text-gray-400 border-gray-500/25",
      pulse: false,
    },
  };
  const c = configs[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.badge}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${c.dot} ${c.pulse ? "animate-pulse" : ""}`}
      />
      {c.label}
    </span>
  );
}

function DemoCardVisual({ demo, dm }: { demo: Demo; dm: boolean }) {
  return (
    <div
      className="relative h-36 overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${demo.colors[0]}, ${demo.colors[1]})`,
      }}
    >
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Radial vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
      {/* Floating circles decoration */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/10" />
      {/* Main icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-5xl text-white/25 font-mono select-none"
          style={{ fontWeight: 100, letterSpacing: "-0.05em" }}
        >
          {demo.icon}
        </span>
      </div>
      {/* Status badge */}
      <div className="absolute top-3 right-3">
        <StatusBadge status={demo.status} />
      </div>
      {/* Category chip */}
      <div className="absolute bottom-3 left-3">
        <span className="text-xs text-white/70 bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
          {demo.category}
        </span>
      </div>
    </div>
  );
}

function DemoCard({
  demo,
  index,
  dm,
  onOpen,
}: {
  demo: Demo;
  index: number;
  dm: boolean;
  onOpen: (demo: Demo) => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`group relative overflow-hidden rounded-2xl border flex flex-col transition-all duration-300 ${
        dm
          ? "bg-gray-900 border-white/5 hover:border-white/12"
          : "bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200"
      }`}
    >
      <DemoCardVisual demo={demo} dm={dm} />

      <div className="flex-1 p-5 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3
            className={`text-base font-medium leading-snug group-hover:text-indigo-500 transition-colors ${
              dm ? "text-white" : "text-gray-900"
            }`}
          >
            {demo.title}
          </h3>
        </div>
        <p
          className={`text-sm leading-relaxed line-clamp-2 mb-4 flex-1 ${
            dm ? "text-gray-400" : "text-gray-500"
          }`}
        >
          {demo.description}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {demo.tags.map((tag) => (
            <span
              key={tag}
              className={`text-xs px-2 py-0.5 rounded-md font-mono ${
                dm
                  ? "bg-white/5 text-gray-400"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {tag}
            </span>
          ))}
        </div>

        <div
          className={`flex items-center justify-between pt-4 border-t ${
            dm ? "border-white/5" : "border-gray-50"
          }`}
        >
          <span
            className={`text-xs flex items-center gap-1.5 ${
              dm ? "text-gray-600" : "text-gray-400"
            }`}
          >
            <Clock size={11} />
            {demo.date}
          </span>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onOpen(demo)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
              demo.status === "live"
                ? dm
                  ? "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30"
                  : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                : dm
                ? "bg-white/5 text-gray-500 hover:bg-white/10"
                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
            }`}
          >
            {demo.status === "live" ? (
              <>
                <Zap size={11} />
                查看 Demo
              </>
            ) : (
              <>
                <ChevronRight size={11} />
                了解更多
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}

function DemoModal({
  demo,
  dm,
  onClose,
}: {
  demo: Demo;
  dm: boolean;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 backdrop-blur-md ${
          dm ? "bg-gray-950/80" : "bg-white/80"
        }`}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={`relative w-full max-w-xl rounded-2xl overflow-hidden border shadow-2xl ${
          dm
            ? "bg-gray-900 border-white/10"
            : "bg-white border-gray-200 shadow-gray-200/50"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Visual header */}
        <div
          className="relative h-44 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${demo.colors[0]}, ${demo.colors[1]})`,
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/10" />

          {/* Demo preview area for live demos */}
          {demo.status === "live" ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.6, 0.9, 0.6],
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-6xl text-white/40 font-mono select-none"
                style={{ fontWeight: 100 }}
              >
                {demo.icon}
              </motion.div>
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="text-xs text-white/60 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full">
                  完整 Demo 即将开放 · Coming Soon
                </span>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
              <span className="text-5xl text-white/30 font-mono select-none">
                {demo.icon}
              </span>
              <span className="text-sm text-white/50">
                {demo.status === "wip" ? "开发中..." : "敬请期待"}
              </span>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/40 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h2
              className={`text-xl font-medium ${
                dm ? "text-white" : "text-gray-900"
              }`}
            >
              {demo.title}
            </h2>
            <StatusBadge status={demo.status} />
          </div>

          <p
            className={`text-sm leading-relaxed mb-5 ${
              dm ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {demo.longDescription}
          </p>

          {/* Tech stack */}
          <div className="mb-5">
            <p
              className={`text-xs font-medium mb-2 flex items-center gap-1.5 ${
                dm ? "text-gray-500" : "text-gray-400"
              }`}
            >
              <Layers size={11} />
              技术栈
            </p>
            <div className="flex flex-wrap gap-2">
              {demo.techStack.map((tech) => (
                <span
                  key={tech}
                  className={`text-xs px-2.5 py-1 rounded-lg font-mono ${
                    dm
                      ? "bg-white/5 text-gray-300 border border-white/5"
                      : "bg-gray-100 text-gray-600 border border-gray-200"
                  }`}
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {demo.tags.map((tag) => (
              <span
                key={tag}
                className={`text-xs px-2 py-0.5 rounded-md ${
                  dm ? "text-indigo-400" : "text-indigo-600"
                }`}
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Lab({ darkMode }: LabProps) {
  const dm = darkMode;
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedDemo, setSelectedDemo] = useState<Demo | null>(null);

  const filtered = useMemo(() => {
    if (selectedCategory === "全部") return demos;
    return demos.filter((d) => d.category === selectedCategory);
  }, [selectedCategory]);

  const liveCount = demos.filter((d) => d.status === "live").length;
  const wipCount = demos.filter((d) => d.status === "wip").length;
  const plannedCount = demos.filter((d) => d.status === "planned").length;

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
          <div
            className={`flex items-center gap-2 text-sm font-medium mb-3 ${
              dm ? "text-indigo-400" : "text-indigo-600"
            }`}
          >
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            >
              <FlaskConical size={15} />
            </motion.div>
            技术实验室
          </div>
          <h1
            className={`text-4xl font-light tracking-tight mb-3 ${
              dm ? "text-white" : "text-gray-900"
            }`}
          >
            实验室
          </h1>
          <p className={`${dm ? "text-gray-400" : "text-gray-500"}`}>
            这里是我的技术游乐场——探索有趣的算法、视觉效果与交互概念的地方。
          </p>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-6 mt-6"
          >
            {[
              {
                value: liveCount,
                label: "运行中",
                color: dm ? "text-emerald-400" : "text-emerald-600",
              },
              {
                value: wipCount,
                label: "开发中",
                color: dm ? "text-amber-400" : "text-amber-600",
              },
              {
                value: plannedCount,
                label: "计划中",
                color: dm ? "text-gray-500" : "text-gray-400",
              },
              {
                value: demos.length,
                label: "全部实验",
                color: dm ? "text-white" : "text-gray-900",
              },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <span className={`text-xl font-medium ${stat.color}`}>
                  {stat.value}
                </span>
                <span
                  className={`text-sm ${
                    dm ? "text-gray-600" : "text-gray-400"
                  }`}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Category filter */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-2 flex-wrap mb-8"
        >
          {demoCategories.map((cat) => (
            <motion.button
              key={cat}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                selectedCategory === cat
                  ? dm
                    ? "bg-white text-gray-900"
                    : "bg-gray-900 text-white"
                  : dm
                  ? "text-gray-500 hover:text-gray-300 border border-white/5 hover:border-white/10"
                  : "text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {cat}
              {cat !== "全部" && (
                <span
                  className={`ml-1.5 text-xs ${
                    selectedCategory === cat
                      ? dm
                        ? "text-gray-500"
                        : "text-gray-400"
                      : dm
                      ? "text-gray-600"
                      : "text-gray-400"
                  }`}
                >
                  {demos.filter((d) => d.category === cat).length}
                </span>
              )}
            </motion.button>
          ))}

          {/* Hint */}
          <span
            className={`ml-auto text-xs flex items-center gap-1.5 ${
              dm ? "text-gray-600" : "text-gray-400"
            }`}
          >
            <Sparkles size={11} />
            {filtered.length} 个实验
          </span>
        </motion.div>

        {/* Demo grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCategory}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filtered.map((demo, i) => (
              <DemoCard
                key={demo.id}
                demo={demo}
                index={i}
                dm={dm}
                onOpen={setSelectedDemo}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className={`mt-16 p-8 rounded-2xl border text-center ${
            dm
              ? "border-white/5 bg-gray-900/50"
              : "border-gray-100 bg-gray-50/50"
          }`}
        >
          <FlaskConical
            size={24}
            className={`mx-auto mb-3 ${
              dm ? "text-gray-600" : "text-gray-300"
            }`}
          />
          <p
            className={`text-sm mb-1 ${
              dm ? "text-gray-400" : "text-gray-500"
            }`}
          >
            有什么有趣的想法想一起探索？
          </p>
          <a
            href="mailto:hello@chenmo.dev"
            className={`text-sm inline-flex items-center gap-1.5 mt-2 hover:underline ${
              dm ? "text-indigo-400" : "text-indigo-600"
            }`}
          >
            <ExternalLink size={12} />
            发邮件给我
          </a>
        </motion.div>
      </div>

      {/* Demo modal */}
      <AnimatePresence>
        {selectedDemo && (
          <DemoModal
            demo={selectedDemo}
            dm={dm}
            onClose={() => setSelectedDemo(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
