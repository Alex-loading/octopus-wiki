## ADDED Requirements

### Requirement: Admin can import Feishu document into article content
系统 SHALL 在文章管理页面提供飞书文档链接输入与导入操作，并在导入时使用当前有效 `configId` 调用转换接口。

#### Scenario: Import succeeds with valid docUrl and configId
- **WHEN** 管理员输入合法飞书文档链接并触发导入，且页面存在有效 `configId`
- **THEN** 系统 MUST 调用 `/api/convert` 并传递 `docUrl` 与 `configId`

### Requirement: Imported markdown overwrites article body directly
系统 SHALL 在转换成功后将返回的 `markdown` 直接覆盖文章正文输入区，不要求二次确认。

#### Scenario: Convert returns markdown successfully
- **WHEN** `/api/convert` 返回成功且包含 `data.markdown`
- **THEN** 系统 MUST 用该 `markdown` 覆盖当前正文内容并提示导入成功

### Requirement: Import errors are visible with backend code and message
系统 SHALL 在导入失败时展示后端错误码与错误信息，便于管理员定位问题。

#### Scenario: Convert request fails
- **WHEN** `/api/convert` 返回失败响应或网络异常
- **THEN** 系统 MUST 在页面错误区域展示可读错误信息，并包含后端 `code`（若有）
