## 1. Repository 接口与数据模型

- [x] 1.1 在 `src/app/content/repository.ts` 新增飞书配置创建接口封装（`POST /api/configs`）及类型定义
- [x] 1.2 在 `src/app/content/repository.ts` 新增飞书文档转换接口封装（`POST /api/convert`）及类型定义
- [x] 1.3 统一飞书接口错误映射，输出可展示的 `code + message` 文案

## 2. Admin 页面导入能力

- [x] 2.1 在 `src/app/pages/AdminArticles.tsx` 新增飞书文档链接输入框与导入按钮
- [x] 2.2 增加导入状态管理（空配置阻断、导入中禁用、成功/失败提示）
- [x] 2.3 导入成功后将返回 `markdown` 直接覆盖正文字段 `form.content`

## 3. 配置弹窗与 configId 生命周期

- [x] 3.1 在 `AdminArticles` 新增“配置”按钮与弹窗表单（feishu + storage 必填字段）
- [x] 3.2 配置提交成功后持久化 `configId` 到本地存储并在页面展示当前值
- [x] 3.3 再次保存配置时用新 `configId` 覆盖旧值，后续导入仅读取最新值

## 4. UI 一致性与回归验证

- [x] 4.1 保持新增导入区块与弹窗在浅色/深色模式下与现有后台风格一致
- [x] 4.2 验证原有文章创建、编辑、删除、发布流程在新增功能后仍可正常使用
- [ ] 4.3 手工验证关键路径：先配置→导入成功覆盖正文→保存文章、更新配置后再次导入、导入失败提示
