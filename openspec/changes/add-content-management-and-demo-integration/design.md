## Context

当前站点以 Vite + React 前端为主，文章与 demo 数据主要存放在 `src/app/data/*.ts` 静态文件中。该模式上线简单，但在以下方面受限：
- 内容持久化与版本管理割裂，无法通过数据库进行查询、筛选与审计。
- 文章更新必须改代码并重新发版，运营效率低。
- demo 与文章缺少统一关联模型，跨页面复用与推荐逻辑难以扩展。

约束：保持现有前端页面结构（`Blog/Post/Lab`）可平滑迁移，优先低运维成本方案，并兼容未来扩展（标签、系列、草稿、定时发布）。

## Goals / Non-Goals

**Goals:**
- 建立文章与 demo 的统一内容数据模型，并持久化到数据库。
- 提供标准化内容更新流程（创建/编辑/校验/发布），使“更新内容”与“发布代码”解耦。
- 在前端引入统一内容访问层，支持列表、详情、关联 demo 的读取。
- 支持渐进迁移：已有静态内容可分批入库，不阻塞当前站点可用性。

**Non-Goals:**
- 不在本次变更中实现完整 CMS UI（仅定义最小可用更新路径）。
- 不在本次变更中重构站点视觉与路由结构。
- 不引入复杂搜索/推荐算法，仅保留基础查询与关联能力。

## Decisions

1. 采用“托管数据库 + 轻量 API/BaaS”架构（优先 Supabase/Postgres）
- 原因：前端项目可快速接入，降低自建后端与运维成本，同时保留 SQL 查询能力。
- 备选方案：
  - 自建 Node API + MySQL：灵活但建设成本更高。
  - 继续使用本地 Markdown/JSON：更新流程仍依赖代码发版，无法满足目标。

2. 建立统一内容模型（文章、demo、关联表）
- `articles`：slug、title、summary、content_md/content_html、status、published_at、tags、updated_by。
- `demos`：slug、title、description、demo_url/repo_url、status、tags。
- `article_demos`：article_id、demo_id、order_index（支持文章内 demo 编排）。
- 原因：将“内容实体”与“展示页面”解耦，支持一篇文章关联多个 demo。

3. 前端新增内容仓储层（Repository）并保留静态兜底
- 在 `src/app` 中新增内容访问服务，统一封装读取接口：`listArticles`、`getArticleBySlug`、`listDemos`、`listDemosByArticle`。
- 迁移期若数据库不可用，可回退到本地静态数据，保证站点稳定。
- 原因：降低页面组件对数据源的耦合，便于逐步替换与测试。

4. 采用“Git 驱动内容更新 + 入库同步”作为最小可用流程
- 内容作者通过标准化内容文件（Markdown + Frontmatter）提交 PR。
- CI 进行 schema 校验与链接检查，合并后触发同步脚本写入数据库。
- 原因：复用现有仓库协作模式，比立即建设 CMS 后台更快落地。
- 备选：直接数据库后台录入；该方式易用但需要额外权限模型与 UI 开发。

## Risks / Trade-offs

- [数据库成为运行时依赖] → 通过静态兜底数据 + 缓存策略降低可用性风险。
- [内容模型设计早期不完善] → 保留可扩展字段（jsonb/metadata），并以迁移脚本演进。
- [同步链路失败导致数据不一致] → CI 增加幂等同步与校验报告，失败时阻断发布。
- [更新流程对非技术同学仍有门槛] → 提供模板、校验提示与最小操作文档，后续再评估 CMS 化。

## Migration Plan

1. 定义并创建数据库表结构与索引，准备初始化脚本。
2. 抽象前端内容访问层，并将 `Blog/Post/Lab` 页面改为通过仓储层取数。
3. 实现静态数据与数据库双读开关（feature flag/env），确保可回退。
4. 编写内容同步脚本，将现有 `posts.ts` 与 demo 数据导入数据库。
5. 上线 CI 校验与同步流程，先在预发布环境验证。
6. 分批切流到数据库主读，监控错误率与加载性能；异常时回滚至静态兜底。

## Open Questions

- 是否优先使用 Supabase，还是接入已有团队数据库平台？
- 文章正文最终以 Markdown 渲染还是预编译 HTML 存储为主？
- demo 内容是否需要独立的审核状态（如 `draft/reviewed/published`）？
- 是否需要在本次变更中纳入基础鉴权（仅编辑者可写入）？
