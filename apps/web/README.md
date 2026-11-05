# Studio Web

## 页面路由

Web 使用 TanStack Router 文件路由。`src/routes` 是页面地址和层级的唯一声明；`src/routeTree.gen.ts` 由生成器维护，不手动编辑。Vite 在开发和构建时更新路由树；独立类型检查前运行 `pnpm routes:generate`（`lint:types` 已包含）。

- `_app`：会话检查与应用 Shell；页面异常和加载提示保留 Shell。
- `_app/_schema`：共享 Schema 会话；`schema-list` 为目录，`schema-manager` 布局包含侧栏。各子文件直接挂载图类型、图、草稿或编辑器。
- `_app/explorer`：共享探索资源；`snapshots/index` 为列表，`snapshots/$snapshotId` 为画布。
- `login`：登录及应用内返回地址；`console`：查询页。

页面实现与路由放在同一目录，不再维护 `src/pages`。`route.tsx`、`index.tsx` 和动态参数文件声明路由；以 `-` 开头的文件存放当前路由的组件、辅助函数与测试，生成器不将其注册为路由，测试仍由 Vitest 收集。共享实现放在最近的公共父路由目录。

- `login/-Page.tsx`：登录页面。
- `_app/console`：查询页面、Schema 树绑定与探索结果适配。
- `_app/_schema/-Session.tsx`、`-context.tsx`：Schema 路由共用的会话与服务上下文。
- `_app/_schema/schema-manager`：侧栏布局；`graphtype/-Editor.tsx` 供创建、查看、编辑与草稿路由复用。
- `_app/explorer/-Layout.tsx`：探索资源布局；`snapshots/-Snapshot.tsx` 适配画布与离开确认。

URL 参数由路由解码和校验，导航使用 `to/params/search`。应用负责菜单、侧栏、返回、会话失效跳转和未保存探索的离开确认。组件库不引入 Router，也不根据 URL 或通用视图枚举分发页面。详情中的显示页签、编辑模式和查询结果格式仍属于组件交互状态。

部署前缀来自 `APP_CONFIG.basePath`，由 Router 统一应用。登录返回及会话过期支持 query/hash；身份失效时绕过未保存拦截并清理应用资源。GUI 同样使用 TanStack 文件路由，独立维护自己的路由树和部署前缀。

## Studio Server 服务

Web 的 UI 使用 `studio-ui-internal`，HTTP 协议和设置、布局持久化复用 `@vesoft-inc/studio-ui/adapters/studio-server`。只有这个公共包入口允许应用导入；不混用两套 Provider 和组件。登录、OAuth、连接、用户会话、错误提示和路由仍由 Web 管理。

`services/fetcher.ts` 创建普通与后台 Axios 实例，使用同样的响应解析和会话取消规则。后台请求关闭瞬时错误提示；设置保存等操作使用普通实例。GQL 薄包装保留内部逐请求的错误提示和消息过滤选项，公共服务契约仅使用取消信号和查询超时。

应用会话持有 `StudioServerAdapters`，按身份和 Schema 复用编辑器服务及布局写队列；路由卸载不清理队列。会话失效先取消旧请求，再清理适配实例。全局 SchemaController 在每次操作开始时选取当前身份的服务。已有设置 key、布局 v1 key 和文档格式保持兼容。

开发、Vitest 和源码类型检查仅为适配入口配置精确的源码映射，公共包本身仍只导出构建产物。运行 `pnpm build:studio-ui` 后，用 `STUDIO_UI_INTERNAL_DIST=1 pnpm --filter nebula-studio exec vite build` 验证正式入口；此命令不会覆盖 Server 内嵌资源。
