## ADDED Requirements

### Requirement: Feishu import controls are integrated into existing admin article form
系统 SHALL 将飞书导入输入、配置入口和导入动作集成到现有文章管理页面中，不新增独立配置页面。

#### Scenario: Admin opens article management page
- **WHEN** 管理员访问 `/admin/articles`
- **THEN** 页面 MUST 同时提供文章编辑表单与飞书导入控制区块

### Requirement: New controls follow existing admin UI style
系统 SHALL 复用现有后台视觉风格、主题与交互反馈方式，避免引入与系统不一致的新样式体系。

#### Scenario: Rendering in light/dark mode
- **WHEN** 页面在浅色或深色模式下展示飞书导入与配置弹窗
- **THEN** 新增控件 MUST 与现有后台表单组件保持一致的布局、边框、颜色语义与状态反馈

### Requirement: Existing article save workflow remains functional
系统 SHALL 在增加飞书导入功能后保持原有文章创建、编辑、删除与发布流程可正常执行。

#### Scenario: Save article after import
- **WHEN** 管理员完成飞书导入并继续执行文章保存或发布
- **THEN** 系统 MUST 按原有后台流程处理文章写入，不改变既有权限与校验边界
