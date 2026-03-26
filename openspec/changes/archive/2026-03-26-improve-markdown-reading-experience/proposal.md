## Why

当前文章页使用手写的逐行 Markdown 解析，仅支持少量语法（如部分标题、列表、粗体、行内代码），导致代码块、引用、链接、表格等常见内容无法稳定渲染，阅读节奏与可读性也不一致。随着文章管理闭环已完成，现在需要提升 Markdown 渲染能力与版式质量，确保读者获得统一、专业的阅读体验。

## What Changes

- 将文章详情页的 Markdown 渲染从手写规则升级为基于 `react-markdown` 的组件化渲染方案。
- 引入 `remark-gfm` 支持 GFM 语法（表格、任务列表、删除线等）。
- 引入 `rehype-sanitize` 做内容安全清洗，避免不受控 HTML 注入风险。
- 引入 `rehype-slug` 与 `rehype-autolink-headings`，增强标题锚点与目录联动体验。
- 统一文章正文的 Typography 规则（段落间距、标题层级、列表、引用、代码块、分隔线、链接）并适配明暗主题。
- 保持现有页面结构与视觉风格基线，不新增页面、不改变内容数据模型。

## Capabilities

### New Capabilities
- `markdown-reading-renderer`: 定义文章正文 Markdown 的解析、安全约束、元素渲染映射与阅读样式规范。

### Modified Capabilities
- （无）

## Impact

- 影响代码：`src/app/pages/Post.tsx` 的 Markdown 渲染实现将被替换为库驱动渲染与节点样式映射。
- 影响依赖：新增 Markdown 解析与插件依赖（`react-markdown`、`remark-gfm`、`rehype-sanitize`、`rehype-slug`、`rehype-autolink-headings`）。
- 影响体验：文章正文对常见 Markdown 语法支持更完整，长文阅读节奏与可扫描性提升。
- 影响安全：通过渲染管线的 sanitize 策略降低富文本注入风险。
