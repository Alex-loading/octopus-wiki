## Context

当前 `featured` 字段已存在于 `articles` 表，并已用于首页“精选文章”分组展示；但后台 `AdminArticles` 页面未提供该字段的编辑入口。内容运营若要调整精选状态，需要直接改库，不符合日常运营流程与权限最小化原则。

本次变更限定在现有前端管理台与现有 Supabase RLS 体系内实现，不新增后端服务，不改变公开路由。

## Goals / Non-Goals

**Goals:**
- 在后台文章列表提供单击操作，使管理员可切换文章 `featured` 状态。
- 复用现有管理员鉴权与错误映射机制，保证非管理员不可写。
- 操作后即时更新列表状态与反馈，减少误判与重复操作。

**Non-Goals:**
- 不新增“精选排序”“精选数量上限”“定时精选”等策略能力。
- 不调整首页展示逻辑与 Blog 页排序逻辑。
- 不引入新的数据库表、字段或外部依赖。

## Decisions

1. **在 `AdminArticles` 列表内提供行级切换按钮（设为精选/取消精选）**
   - Rationale: 与当前“发布/草稿、删除”等运营动作保持同层级交互，学习成本最低。
   - Alternative considered: 在编辑弹窗中增加开关；但会增加操作路径（需先进入编辑）。

2. **在 `repository.ts` 增加专用写入函数（如 `setArticleFeatured`）**
   - Rationale: 与现有 `listAdminArticles` 等数据访问模式一致，统一处理管理员校验与错误映射。
   - Alternative considered: 在页面直接写 Supabase query；但会造成鉴权与错误处理分散。

3. **操作完成后采用“本地状态替换 + 兜底全量刷新”策略**
   - Rationale: 单条更新可获得更好交互响应；失败或状态不一致时可回退到全量拉取。
   - Alternative considered: 每次操作后强制全量重取；实现简单但体验较慢。

## Risks / Trade-offs

- **[Risk] 并发编辑导致列表状态与数据库短暂不一致** → Mitigation: 更新接口返回最终状态并覆盖本地项，必要时触发一次列表重取。
- **[Risk] RLS/JWT 元数据配置不完整导致按钮可见但写入失败** → Mitigation: 复用现有 `getUserRoleState` 预检查，并在失败时明确提示权限原因。
- **[Trade-off] 暂不支持批量精选** → Mitigation: 保持本次范围最小，后续按运营需求再扩展批量能力。

## Migration Plan

1. 在 `repository.ts` 增加精选状态更新方法，并复用现有错误映射。
2. 在 `AdminArticles.tsx` 增加按钮与 loading/禁用态，调用上述方法更新单条文章。
3. 本地联调管理员账号流程，验证设为精选与取消精选都能成功。
4. 部署后在后台执行冒烟：切换一篇文章精选状态，并验证首页“精选文章”区域同步变化。

**Rollback:**
- 前端回滚到上一版本即可移除该按钮；数据库与 RLS 无结构变更，无需 schema 回滚。

## Open Questions

- 按钮位置最终放在“操作列”还是与状态标签并列（取决于当前列表拥挤程度）。
- 是否需要在后台列表显式显示“精选”标签（仅按钮文案是否足够）。
