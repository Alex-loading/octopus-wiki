import type { Demo } from "../data/demos";

export const DEMO_STATUSES = { live: "运行中", wip: "开发中", planned: "计划中" } as const;
export const DEMO_ICONS = [
  { value: "sparkles", label: "灵感星光", legacy: "✦" },
  { value: "wand-sparkles", label: "闪亮创意", legacy: "✧" },
  { value: "flower-2", label: "创意花园", legacy: "✿" },
  { value: "mouse-pointer-2", label: "交互探索", legacy: "◎" },
  { value: "blocks", label: "工具百宝箱", legacy: "⊞" },
  { value: "command", label: "效率助手", legacy: "⌘" },
  { value: "square-code", label: "代码世界", legacy: "⟨⟩" },
  { value: "workflow", label: "自动化", legacy: "⟳" },
  { value: "activity", label: "曲线与动效", legacy: "∿" },
  { value: "music", label: "声音与音乐", legacy: "♫" },
  { value: "chart-column", label: "数据与可视化", legacy: "◈" },
  { value: "file-user", label: "写作与简历", legacy: "✎" },
  { value: "palette", label: "设计与配色" },
  { value: "bot", label: "智能助手" },
  { value: "globe", label: "网站与探索" },
  { value: "gamepad-2", label: "游戏与趣味" },
] as const;

export function demoIconOption(value: string) {
  return DEMO_ICONS.find(icon => icon.value === value || ("legacy" in icon && icon.legacy === value));
}

export type DemoDraft = Omit<Demo, "id" | "slug">;

export function emptyDemoDraft(): DemoDraft {
  const now = new Date();
  return {
    title: "", description: "", longDescription: "", category: "工具",
    tags: [], techStack: [], status: "planned", colors: ["#6366f1", "#8b5cf6"],
    icon: "sparkles", date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    deploymentUrl: "", githubUrl: "", isPublic: true,
  };
}

export function projectLink(value?: string | null, label = "项目链接"): string {
  const text = value?.trim() ?? "";
  if (!text) return "";
  if (text.length > 4096 || /[\s\\]/.test(text) || !/^https?:\/\//i.test(text))
    throw new Error(`${label}需为完整的 HTTP 或 HTTPS 地址。`);
  let url: URL;
  try { url = new URL(text); } catch { throw new Error(`${label}格式不正确。`); }
  if (!url.hostname || url.username || url.password)
    throw new Error(`${label}不能包含账号或密码。`);
  return url.href;
}

export function resolveDemoLinks(row: { demo_url?: string | null; repo_url?: string | null; project_url?: string | null }) {
  const safeLink = (value?: string | null) => {
    try { return projectLink(value); } catch { return ""; }
  };
  let deploymentUrl = safeLink(row.demo_url);
  let githubUrl = safeLink(row.repo_url);
  const legacyUrl = safeLink(row.project_url);
  if (legacyUrl) {
    const hostname = new URL(legacyUrl).hostname.toLowerCase();
    if (hostname === "github.com" || hostname === "www.github.com") {
      githubUrl ||= legacyUrl;
    } else {
      deploymentUrl ||= legacyUrl;
    }
  }
  return { deploymentUrl, githubUrl };
}

export function splitDemoTags(value: string): string[] {
  return [...new Set(value.split(/[,，\n]/).map(item => item.trim()).filter(Boolean))];
}

export function validateDemoDraft(draft: DemoDraft) {
  const required = (value: string, name: string, limit: number) => {
    const text = value.trim();
    if (!text || text.length > limit) throw new Error(`${name}需填写 1–${limit} 个字符。`);
    return text;
  };
  const list = (values: string[], name: string) => {
    const result = [...new Set(values.map(value => value.trim()).filter(Boolean))];
    if (result.length > 20 || result.some(value => value.length > 50))
      throw new Error(`${name}最多 20 项，每项不超过 50 个字符。`);
    return result;
  };
  if (!Object.hasOwn(DEMO_STATUSES, draft.status)) throw new Error("请选择有效的项目状态。");
  if (draft.longDescription.trim().length > 10000) throw new Error("详情最多 10000 个字符。");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.date)) throw new Error("请选择有效的项目月份。");
  if (draft.colors.length !== 2 || draft.colors.some(color => !/^#[0-9a-f]{6}$/i.test(color)))
    throw new Error("请选择有效的封面配色。");
  if (typeof draft.isPublic !== "boolean") throw new Error("请选择项目是否公开。");
  return {
    title: required(draft.title, "标题", 120),
    description: required(draft.description, "简介", 500),
    long_description: draft.longDescription.trim(),
    category: required(draft.category, "分类", 40),
    tags: list(draft.tags, "标签"), tech_stack: list(draft.techStack, "技术栈"),
    status: draft.status, colors: draft.colors,
    icon: required(draft.icon, "封面图标", 16), date: draft.date,
    demo_url: projectLink(draft.deploymentUrl, "部署链接") || null,
    repo_url: projectLink(draft.githubUrl, "GitHub 链接") || null,
    // Retire the combined field on save, so clearing a link cannot resurrect it.
    project_url: null,
    is_public: draft.isPublic,
  };
}
