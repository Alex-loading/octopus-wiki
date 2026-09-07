## Why

当前文章管理后台已经具备手动编辑与发布能力，但缺少从飞书文档一键导入 Markdown 的入口，导致运营发布依赖手工复制粘贴且容易出错。现在已有稳定的飞书转换服务接口，适合补齐后台导入与配置管理链路，提升发布效率并降低操作成本。

## What Changes

- 在文章管理页面新增“飞书导入”输入区，支持输入飞书文档链接并触发转换。
- 在文章管理页面新增“配置”按钮与弹窗，用于创建/更新飞书与存储运行时配置。
- 配置保存成功后持久化 `configId`，后续导入统一使用 `docUrl + configId` 调用转换接口。
- 每次修改配置时重新创建配置并覆盖本地存储的 `configId`，确保后续导入使用最新配置。
- 转换成功后将返回的 Markdown 直接覆盖文章正文输入区，并展示导入结果反馈（如图片数量）。
- 统一错误反馈展示接口返回 `code` 与 `message`，保持与现有后台提示风格一致。

## Capabilities

### New Capabilities
- `feishu-article-import`: 后台飞书文档导入流程，覆盖链接输入、转换调用、正文覆盖与错误提示。
- `feishu-config-runtime-management`: 后台配置弹窗流程，覆盖配置创建、`configId` 持久化与更新替换语义。
- `article-admin-console-feishu-extension`: 在现有文章管理页面中增加飞书导入区块与配置入口，并保持现有 UI 风格一致。

### Modified Capabilities
- （无）

## Impact

- 影响前端页面：`src/app/pages/AdminArticles.tsx` 需要增加导入区块、配置弹窗和状态管理。
- 影响前端服务层：`src/app/content/repository.ts` 需要新增飞书配置与转换 API 封装。
- 影响浏览器存储：新增 `configId` 本地持久化逻辑（例如 `localStorage`）。
- 影响部署配置：前端需有可访问飞书转换服务的 API 基础路径（默认 `/api`）。
