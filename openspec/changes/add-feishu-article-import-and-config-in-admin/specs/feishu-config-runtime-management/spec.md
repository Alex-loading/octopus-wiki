## ADDED Requirements

### Requirement: Admin can create runtime config from a modal
系统 SHALL 在文章管理页面提供配置按钮和弹窗，用于填写飞书与存储配置并创建运行时配置。

#### Scenario: Config modal submits valid payload
- **WHEN** 管理员在配置弹窗中填写必填项并提交
- **THEN** 系统 MUST 调用 `/api/configs` 创建配置并处理返回结果

### Requirement: ConfigId is persisted for future imports
系统 SHALL 在配置创建成功后持久化返回的 `configId`，页面刷新后仍可用于导入。

#### Scenario: Config creation succeeds
- **WHEN** `/api/configs` 返回成功且包含 `data.configId`
- **THEN** 系统 MUST 保存该 `configId` 到本地存储并在页面显示当前可用配置标识

### Requirement: Updating config replaces previous configId
系统 SHALL 在管理员重新保存配置时使用新返回的 `configId` 覆盖旧值，后续导入必须使用最新值。

#### Scenario: Admin updates config again
- **WHEN** 管理员再次提交配置并收到新的 `configId`
- **THEN** 系统 MUST 覆盖本地旧 `configId` 并将新值作为后续 `/api/convert` 的唯一配置来源
