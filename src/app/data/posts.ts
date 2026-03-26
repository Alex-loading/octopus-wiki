export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  tags: string[];
  category: string;
  date: string;
  readTime: number;
  featured?: boolean;
  status?: "draft" | "published";
}

export const posts: Post[] = [
  {
    id: "1",
    slug: "the-art-of-deep-work",
    title: "专注的艺术：深度工作的实践与反思",
    excerpt: "在信息爆炸的时代，专注力成为最稀缺的资源。如何在嘈杂的世界中找回深度思考的能力？",
    coverImage: "https://images.unsplash.com/photo-1772588627479-06ac7a264916?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwd3JpdGluZyUyMGRlc2slMjBjb2ZmZWUlMjBub3RlYm9va3xlbnwxfHx8fDE3NzM5MTc5MTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    tags: ["效率", "思维", "生活方式"],
    category: "思考",
    date: "2026-03-15",
    readTime: 8,
    featured: true,
    content: `
## 什么是深度工作？

深度工作（Deep Work）是指在无干扰的专注状态下进行的认知活动，这些活动能将你的认知能力推到极限，创造出新的价值，磨练你的技能，且难以复制。

与之相对的是"浮浅工作"——那些在分心状态下完成的、认知需求不高的事务性任务。

## 为什么深度工作变得越来越难？

现代社会的信息流，像一条永不停歇的河流，不断地冲刷我们的注意力。社交媒体的通知、即时通讯软件的消息、无穷无尽的新闻推送……这些东西设计的本质，就是为了让你**停不下来**。

每一次切换注意力，我们的大脑都需要付出额外的"切换成本"。研究表明，从分心状态恢复到专注状态，平均需要 23 分钟。

## 实践深度工作的三个方法

### 1. 设定仪式感

深度工作需要仪式来触发专注状态。你可以：
- 固定一个工作时间段（比如早上 6-9 点）
- 选择一个专属空间（只在这里做深度工作）
- 关闭所有通知，手机放到视线之外

### 2. 接受无聊

我们害怕无聊，所以任何空闲时间都用刷手机来填满。但正是在无聊中，创意才得以萌发。试着在等电梯、排队时，就这样站着，什么也不做——你会发现思维开始自由流动。

### 3. 刻意休息

深度工作不是持续不断的，它需要充分的休息来维持质量。一个健康的节奏是：90 分钟专注工作，然后进行 20-30 分钟的深度休息。

## 我的实践经验

过去三个月里，我每天早上 6:30 起床，在 7:00-9:30 这段时间进行深度工作。这段时间里我关闭一切通知，泡一杯咖啡，专注在最重要的一件事上。

效果出乎意料地好。我发现自己的工作质量提升了，而且那种心流状态带来的满足感，是任何娱乐都无法替代的。

深度工作不是关于工作时间的长短，而是关于**质量**。
    `
  },
  {
    id: "2",
    slug: "building-with-ai",
    title: "与 AI 协作：开发者的新工作流",
    excerpt: "AI 工具不是要取代开发者，而是让我们从重复劳动中解放出来，专注于真正有创意的工作。",
    coverImage: "https://images.unsplash.com/photo-1763568258535-fa1066506571?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNobm9sb2d5JTIwY29kaW5nJTIwZGV2ZWxvcGVyJTIwd29ya3NwYWNlfGVufDF8fHx8MTc3MzkxNzkxMnww&ixlib=rb-4.1.0&q=80&w=1080",
    tags: ["AI", "开发", "工具"],
    category: "技术",
    date: "2026-03-10",
    readTime: 12,
    featured: true,
    content: `
## AI 改变了什么？

过去一年，我的工作流发生了根本性的变化。不是因为 AI 替代了我，而是因为 AI 让我能做以前根本没时间做的事。

## 代码生成：从 "如何写" 到 "写什么"

当我使用 AI 辅助编程时，我的认知重心从**如何实现**转移到了**应该实现什么**。

这是一个质的飞跃。不再纠结于 API 语法、不再反复查文档，而是专注在系统设计、架构决策和用户体验上。

## 我的 AI 工作流

\`\`\`
1. 问题拆解 → 用自然语言描述需求
2. AI 生成初稿 → 快速验证思路
3. 人工审查 → 理解每一行代码
4. 迭代优化 → 基于真实反馈调整
\`\`\`

## 注意事项

AI 生成的代码不总是对的。它会自信地写出错误的代码，而且看起来很像正确的代码。

**永远不要盲目复制粘贴。**

理解代码背后的逻辑，是使用 AI 工具的前提。否则，你只是在借用你不懂的魔法。

## 一个小型工作流看板（GFM 示例）

| 阶段 | 目标 | 状态 |
| --- | --- | --- |
| 需求拆解 | 明确问题边界 | 完成 |
| 方案验证 | 快速验证关键假设 | 进行中 |
| 上线回顾 | 汇总收益与风险 | 待开始 |

- [x] 完成问题拆解
- [ ] 完成方案验证
- [ ] 完成上线回顾

如果某条路径已经失效，就要果断标记为 ~~继续投入~~，转向更有效的方案。

## 结语

我认为，未来最有竞争力的开发者，不是写最多代码的人，而是**最善于与 AI 协作的人**——知道问什么，知道如何验证，知道什么时候相信 AI，什么时候不相信。
    `
  },
  {
    id: "3",
    slug: "design-philosophy",
    title: "设计哲学：少即是多的力量",
    excerpt: "从包豪斯到苹果，最伟大的设计往往是最简洁的。探索极简主义背后的设计思维。",
    coverImage: "https://images.unsplash.com/photo-1759150467548-5a97257e583a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMGRlc2lnbiUyMGluc3BpcmF0aW9uJTIwc3R1ZGlvfGVufDF8fHx8MTc3MzkxNzkxN3ww&ixlib=rb-4.1.0&q=80&w=1080",
    tags: ["设计", "美学", "思考"],
    category: "设计",
    date: "2026-03-05",
    readTime: 6,
    content: `
## "Form follows function"

这句来自建筑师路易斯·沙利文的名言，成为了现代设计的基石。形式服从功能——设计不是装饰，而是解决问题。

## 包豪斯的遗产

1919 年，包豪斯学校在德国魏玛成立。它将艺术与工业设计融合，追求功能与美感的统一。

他们相信：好的设计是无形的。当你使用一件设计良好的物品时，你感受不到设计的存在——你只是自然而然地完成了你想做的事。

## 苹果的极简哲学

乔布斯曾说："简单是终极的复杂。" 

第一代 iPhone 去掉了所有实体按键（几乎），这不是懒惰，而是对复杂性的极度克制。每一个删除的元素背后，都是深思熟虑的权衡。

## 在设计中实践极简

**问每一个元素存在的理由：**
- 这个按钮是必要的吗？
- 这段文字能更短吗？
- 这个颜色有意义吗？

当你开始质疑每一个设计决策，你就开始真正地思考设计了。
    `
  },
  {
    id: "4",
    slug: "travel-philosophy",
    title: "漫游者哲学：在陌生中寻找自我",
    excerpt: "旅行不是逃避，而是一种回归。在陌生的地方，我们往往最清楚地看见自己。",
    coverImage: "https://images.unsplash.com/photo-1637073698184-975f104eae11?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuYXR1cmUlMjBtb3VudGFpbiUyMGxhbmRzY2FwZSUyMHN1bnJpc2V8ZW58MXx8fHwxNzczOTE3OTE2fDA&ixlib=rb-4.1.0&q=80&w=1080",
    tags: ["旅行", "生活方式", "哲学"],
    category: "生活",
    date: "2026-02-28",
    readTime: 7,
    content: `
## 为什么我们旅行？

表面上，我们旅行是为了看新的风景、尝新的食物、见新的朋友。但更深层的动机，往往是一种说不清道不明的渴望——去某个陌生的地方，重新成为一个陌生人。

在熟悉的环境里，我们是固定的。我们有角色：儿子/女儿、员工、朋友。这些角色框住了我们，让我们很难看见自己真实的模样。

## 陌生感的力量

当你置身于一个完全陌生的城市，不认识任何人，没有人对你有任何期待——这种状态是一种奇特的自由。

你可以做任何决定，不需要解释，不需要维持形象。在这种状态下，你做出的选择，往往最接近你真实的自我。

## 慢旅行

我越来越觉得，走马观花式的旅行是一种遗憾。在一个地方住上一个月，在固定的咖啡馆喝咖啡，和当地人成为朋友，融入当地的节奏——这才是真正意义上的旅行。

不是消费景点，而是**体验生活**。
    `
  },
  {
    id: "5",
    slug: "night-city-reflections",
    title: "城市夜行：在霓虹与孤独之间",
    excerpt: "深夜的城市有一种别处没有的气质。喧嚣退去后，你才能听见城市真正的呼吸。",
    coverImage: "https://images.unsplash.com/photo-1635192031335-286567f88662?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaXR5JTIwYXJjaGl0ZWN0dXJlJTIwdXJiYW4lMjBuaWdodCUyMGxpZ2h0c3xlbnwxfHx8fDE3NzM5MTc5MTZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    tags: ["城市", "生活", "随笔"],
    category: "随笔",
    date: "2026-02-20",
    readTime: 5,
    content: `
## 午夜的城市

凌晨两点，大多数人都睡了。城市却没有。

街灯把湿漉漉的地面变成了镜子，映出倒置的世界。偶尔有出租车驶过，红色的尾灯划出一道流光。

我喜欢在这个时候走路。没有目的地，只是走。

## 孤独的质感

城市里的孤独和荒野里的孤独完全不同。荒野的孤独是空旷的，干净的；城市的孤独是稠密的，有质感的。

你被人群包围，却感觉到彻底的孤立。这种感觉很奇特——不是痛苦，而是一种清醒。

## 霓虹灯下的哲学

便利店那块亮着的招牌是我的灯塔。深夜，便利店里总有几个人，各自带着各自的故事坐着，谁也不认识谁。

我常常想，我们都是彼此故事里的背景人物。而我自己的故事，在别人眼里，也只是背景的一部分。

这个想法不让我悲伤，反而让我觉得轻松。
    `
  },
  {
    id: "6",
    slug: "reading-as-practice",
    title: "阅读作为一种修行",
    excerpt: "真正的阅读不是消费信息，而是与作者进行一场跨越时空的对话。",
    coverImage: "https://images.unsplash.com/photo-1602990721338-9cbb5b983c4d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZWFkaW5nJTIwYm9vayUyMGxpYnJhcnklMjBjb3p5fGVufDF8fHx8MTc3MzkxNzkxN3ww&ixlib=rb-4.1.0&q=80&w=1080",
    tags: ["阅读", "思维", "人文"],
    category: "思考",
    date: "2026-02-15",
    readTime: 9,
    content: `
## 我们真的在"读"书吗？

大多数人阅读的方式，是用眼睛扫过文字，让信息进入大脑，然后很快遗忘。

这不是阅读，这是消费。

真正的阅读是主动的、对话式的。你不是在接收信息，而是在和作者争论、质疑、共鸣。

## 费曼阅读法

物理学家费曼有一个习惯：每当他读到一个概念，他会合上书，试着用自己的话把它解释出来。如果解释不清楚，他会回去再读，直到能够用最简单的语言描述为止。

**如果你无法简单地解释它，说明你还没有真正理解它。**

## 建立对话

我读书时喜欢写很多笔记。不是摘抄，而是对话：
- "这里我不同意，因为……"
- "这让我想到……"
- "如果用 X 的理论来看，这个结论会不会……"

这样读完的书，真正变成了你的一部分。

## 选书的哲学

我更倾向于反复读少量的经典，而不是浅尝大量的新书。

一本好书值得读三遍：第一遍了解轮廓，第二遍深入细节，第三遍提炼精华。
    `
  },
  {
    id: "7",
    slug: "color-and-emotion",
    title: "色彩与情绪：视觉语言的密码",
    excerpt: "颜色不只是视觉现象，它直接影响我们的情绪和决策。了解色彩语言，让设计说话。",
    coverImage: "https://images.unsplash.com/photo-1713188090500-a4fb0d2cf309?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGNvbG9yZnVsJTIwZGlnaXRhbCUyMGFydHxlbnwxfHx8fDE3NzM4NTkwNDh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    tags: ["设计", "心理学", "美学"],
    category: "设计",
    date: "2026-02-10",
    readTime: 7,
    content: `
## 色彩的力量

我们对颜色的反应，很大程度上是本能的、非理性的。

红色让我们兴奋，蓝色让我们平静，黄色让我们愉快——这些关联深植于我们的认知系统中，既有文化的影响，也有进化的痕迹。

## 设计中的色彩运用

优秀的设计师不只是选择"好看的颜色"，而是选择**传达正确情绪的颜色**。

**医疗品牌为什么多用蓝色和白色？**
因为蓝色代表信任、专业和平静，白色代表清洁和纯粹。这些颜色组合传达的是：我们是可信赖的、专业的、干净的。

**为什么快餐品牌多用红色和黄色？**
红色刺激食欲和紧迫感，黄色带来愉悦感和可接近性。麦当劳的 Logo 不是偶然的选择。

## 色彩理论基础

理解色彩，需要掌握几个基本概念：

- **色相**：颜色的种类（红、橙、黄……）
- **饱和度**：颜色的纯度（鲜艳 vs 灰暗）
- **明度**：颜色的亮度（亮 vs 暗）

好的配色，往往是在这三个维度上做精心的平衡。
    `
  },
];

export const allTags = Array.from(new Set(posts.flatMap(p => p.tags)));
export const allCategories = Array.from(new Set(posts.map(p => p.category)));
