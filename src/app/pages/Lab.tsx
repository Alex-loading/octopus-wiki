import { useState, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useDemos } from "../content/useDemos";
import { motion, AnimatePresence } from "motion/react";
import {
  FlaskConical,
  ExternalLink,
  GitBranch,
  X,
  Sparkles,
  Clock,
  Layers,
  ChevronRight,
} from "lucide-react";
import type { Demo } from "../data/demos";
import { PROFILE } from "../data/profile";
import { DemoIcon } from "../components/DemoIcon";

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

function DemoCardVisual({ demo }: { demo: Demo }) {
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
        <DemoIcon value={demo.icon} size={56} className="text-white/50" />
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
      <DemoCardVisual demo={demo} />

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
              dm
                ? "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30"
                : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
            }`}
          >
            <ChevronRight size={11} />
            了解更多
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
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <Dialog.Overlay asChild><div
        className={`absolute inset-0 backdrop-blur-md ${
          dm ? "bg-gray-950/80" : "bg-white/80"
        }`}
      /></Dialog.Overlay>

      <Dialog.Content asChild>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={`relative w-full max-w-xl max-h-[85dvh] overflow-y-auto rounded-2xl outline-none border shadow-2xl ${
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

          <div className="absolute inset-0 flex items-center justify-center">
            <DemoIcon value={demo.icon} size={64} className="text-white/60" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="关闭项目详情"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/40 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <Dialog.Title asChild><h2
              className={`text-xl font-medium ${
                dm ? "text-white" : "text-gray-900"
              }`}
            >
              {demo.title}
            </h2></Dialog.Title>
            <StatusBadge status={demo.status} />
          </div>

          <Dialog.Description asChild><p
            className={`text-sm leading-relaxed whitespace-pre-wrap break-words mb-5 ${
              dm ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {demo.longDescription || demo.description}
          </p></Dialog.Description>

          {(demo.deploymentUrl || demo.githubUrl) && (
            <div className="flex flex-wrap gap-3 mb-5">
              {demo.deploymentUrl && (
                <a href={demo.deploymentUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm text-white hover:bg-indigo-500">
                  <ExternalLink size={14} />
                  部署链接
                </a>
              )}
              {demo.githubUrl && (
                <a href={demo.githubUrl} target="_blank" rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${dm ? "border-white/15 text-gray-200 hover:bg-white/5" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                  <GitBranch size={14} />
                  GitHub 仓库
                </a>
              )}
            </div>
          )}

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
      </Dialog.Content>
    </motion.div>
    </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Lab({ darkMode }: LabProps) {
  const dm = darkMode;
  const { demos, loading, error, refresh } = useDemos();
  const demoCategories = useMemo(() => ["全部", ...new Set(demos.map(demo => demo.category).filter(category => category !== "全部"))], [demos]);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedDemo, setSelectedDemo] = useState<Demo | null>(null);

  const filtered = useMemo(() => {
    if (selectedCategory === "全部") return demos;
    return demos.filter((d) => d.category === selectedCategory);
  }, [selectedCategory, demos]);

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
            灵感与创造
          </div>
          <h1
            className={`text-4xl font-light tracking-tight mb-3 ${
              dm ? "text-white" : "text-gray-900"
            }`}
          >
            妙妙屋
          </h1>
          <p className={`${dm ? "text-gray-400" : "text-gray-500"}`}>
            收纳灵感、动手创造，这里放着我做的有趣项目。
          </p>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-6"
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
                label: "全部项目",
                color: dm ? "text-white" : "text-gray-900",
              },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <span className={`text-xl font-medium ${stat.color}`}>
                  {loading || error ? "—" : stat.value}
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
            {loading || error ? "—" : filtered.length} 个项目
          </span>
        </motion.div>

        {loading ? (
          <p role="status" className={`py-12 text-center ${dm ? "text-gray-400" : "text-gray-500"}`}>正在打开妙妙屋…</p>
        ) : error ? (
          <div role="alert" className="py-12 text-center">
            <p className={dm ? "text-gray-400" : "text-gray-500"}>妙妙屋暂时无法加载，请稍后重试。</p>
            <button onClick={refresh} className="mt-3 text-sm text-indigo-500 hover:underline">重新加载</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`py-16 text-center ${dm ? "text-gray-400" : "text-gray-500"}`}>
            <Sparkles className="mx-auto mb-3" size={28} />
            <p>{demos.length ? "这个分类下还没有项目" : "妙妙屋正在布置中"}</p>
            <p className="mt-2 text-sm">有趣的作品会陆续放进来。</p>
          </div>
        ) : null}

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
            {!loading && !error && filtered.map((demo, i) => (
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
            href={`mailto:${PROFILE.email}`}
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
