export interface Demo {
  id: string;
  slug: string;
  title: string;
  description: string;
  longDescription: string;
  category: string;
  tags: string[];
  techStack: string[];
  status: "live" | "wip" | "planned";
  colors: [string, string];
  icon: string;
  date: string;
}

export const demoCategories = ["全部", "可视化", "交互", "动效", "工具"];

export const demos: Demo[] = [
  {
    id: "1",
    slug: "particle-system",
    title: "粒子涌现系统",
    description: "基于 Canvas API 的交互式粒子群模拟，鼠标移动时产生动态吸引/排斥效果，实时参数调节。",
    longDescription:
      "使用纯 Canvas 2D API 实现的粒子物理模拟。每个粒子拥有独立的速度、质量与生命周期，粒子间存在引力与斥力。鼠标移动时会形成局部引力场，创造出流体般的视觉效果。支持实时调整粒子数量、引力强度、轨迹长度等参数。",
    category: "可视化",
    tags: ["Canvas", "Physics", "Interactive"],
    techStack: ["Canvas API", "RequestAnimationFrame", "Vector Math"],
    status: "live",
    colors: ["#6366f1", "#8b5cf6"],
    icon: "✦",
    date: "2026-03",
  },
  {
    id: "2",
    slug: "sort-visualizer",
    title: "排序算法可视化",
    description: "动态展示冒泡、快排、归并、堆排序等算法的执行过程，配合音效反馈与速度调节。",
    longDescription:
      "可视化多种经典排序算法的执行过程。每次比较和交换操作都以动画形式呈现，颜色编码表示不同状态（比较中、已排序、当前指针）。配合 Web Audio API 生成音调反馈，排序越接近完成音调越高。支持暂停/继续和速度调节。",
    category: "可视化",
    tags: ["Algorithm", "Animation", "Audio"],
    techStack: ["React", "Web Audio API", "CSS Transitions"],
    status: "live",
    colors: ["#0ea5e9", "#6366f1"],
    icon: "⟨⟩",
    date: "2026-02",
  },
  {
    id: "3",
    slug: "bezier-editor",
    title: "Bézier 曲线编辑器",
    description: "可视化拖拽编辑 Cubic Bézier 缓动曲线，实时预览动画效果并导出 CSS transition 代码。",
    longDescription:
      "交互式 Cubic Bézier 曲线编辑器，拖拽四个控制点实时更新曲线形态。左侧显示曲线图形，右侧实时预览基于该缓动函数的动画效果。预设了 ease、ease-in、ease-out 等常见缓动曲线，支持一键复制 CSS 代码。",
    category: "工具",
    tags: ["SVG", "Math", "CSS Easing"],
    techStack: ["SVG", "Pointer Events", "CSS Variables"],
    status: "live",
    colors: ["#f59e0b", "#ef4444"],
    icon: "∿",
    date: "2026-02",
  },
  {
    id: "4",
    slug: "fluid-morphing",
    title: "CSS 液态变形",
    description: "探索 CSS clip-path 动画与 SVG feTurbulence 滤镜实现有机流体形态，纯 CSS 驱动。",
    longDescription:
      "完全由 CSS 动画驱动的液态变形效果。使用 SVG feTurbulence 和 feDisplacementMap 滤镜模拟流体扰动，配合 CSS clip-path 的 polygon 动画实现形变。探索了多种混合模式与色彩搭配，目标是在不依赖 JavaScript 运行时的前提下创造最丰富的视觉效果。",
    category: "动效",
    tags: ["CSS", "SVG Filter", "Animation"],
    techStack: ["CSS Animation", "SVG Filters", "clip-path"],
    status: "wip",
    colors: ["#10b981", "#0ea5e9"],
    icon: "◎",
    date: "2026-03",
  },
  {
    id: "5",
    slug: "audio-visualizer",
    title: "音频频谱可视化",
    description: "使用 Web Audio API 实时分析麦克风输入，生成动态频谱波形图与三维粒子响应。",
    longDescription:
      "通过 getUserMedia 获取麦克风输入，利用 Web Audio API 的 AnalyserNode 进行实时 FFT 频谱分析。将频率数据映射到 Canvas 上的动态波形，并驱动一组粒子根据音量强度在三维空间中运动。支持切换不同的可视化模式：波形、频谱柱状、圆形频谱。",
    category: "可视化",
    tags: ["WebAudio", "Canvas", "FFT"],
    techStack: ["Web Audio API", "Canvas 2D", "getUserMedia"],
    status: "wip",
    colors: ["#ec4899", "#8b5cf6"],
    icon: "♫",
    date: "2026-03",
  },
  {
    id: "6",
    slug: "grid-playground",
    title: "CSS Grid 生成器",
    description: "可视化拖拽编辑 CSS Grid 布局，实时导出代码，探索复杂网格排版的无限可能。",
    longDescription:
      "交互式 CSS Grid 布局编辑器。在可视化画布上定义行列轨道，通过拖拽设置网格区域，实时看到 grid-template-areas 的效果。右侧面板实时输出完整的 CSS 代码，支持响应式断点预览。计划集成常见布局模板（圣杯、Bento Grid 等）。",
    category: "工具",
    tags: ["CSS Grid", "Layout", "Code Gen"],
    techStack: ["React", "CSS Grid", "Drag & Drop"],
    status: "planned",
    colors: ["#64748b", "#475569"],
    icon: "⊞",
    date: "2026-04",
  },
  {
    id: "7",
    slug: "generative-art",
    title: "生成艺术引擎",
    description: "基于 Perlin 噪声和数学公式的程序化艺术生成，每次刷新都是独一无二的作品。",
    longDescription:
      "集成多种生成艺术算法的创作引擎：Perlin 噪声流场、L-System 植物生长、Voronoi 图形分割、Reaction-Diffusion 化学反应模拟。提供参数调节面板与随机种子控制，作品可导出为高分辨率 PNG 或 SVG。灵感来自 Processing 社区的创意编码实践。",
    category: "动效",
    tags: ["Perlin Noise", "Generative", "Art"],
    techStack: ["Canvas API", "Math", "WebGL (planned)"],
    status: "planned",
    colors: ["#f97316", "#ec4899"],
    icon: "✿",
    date: "2026-05",
  },
  {
    id: "8",
    slug: "react-state-flow",
    title: "React 状态流可视化",
    description: "实时可视化 React 组件树的状态流转，帮助理解复杂 Context 和 Reducer 的数据流向。",
    longDescription:
      "一个 React DevTools 补充工具，通过代码插桩实时追踪 useState、useReducer、useContext 的状态变化。以有向图的形式展示组件间的数据流，高亮显示每次状态更新触发的重渲染链路。帮助开发者识别不必要的渲染和状态设计问题。",
    category: "工具",
    tags: ["React", "DevTools", "Graph"],
    techStack: ["React", "D3.js", "Proxy API"],
    status: "planned",
    colors: ["#6366f1", "#0ea5e9"],
    icon: "⟳",
    date: "2026-05",
  },
];
