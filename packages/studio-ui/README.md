# Studio UI

`@vesoft-inc/studio-ui` 是仓库内受控的公共 UI 接口层，复用 `studio-ui-internal` 的实现，统一维护对外暴露范围。当前只维护代码拆分、接口与生命周期约束，不处理外部系统接入和安装包交付。

## 包边界

- `studio-ui`：公开 Props、服务契约、作用域生命周期及必要适配。
- `studio-ui-internal`：工作台、内部组件、MobX Store、画布和编辑器实现；Web/GUI 继续直接使用。
- `studio-core`：通用协议、纯算法及现有基础工具，不承担 UI 生命周期或路由管理。

内部包和 core 不得反向依赖 `studio-ui`。同一组件树不混用公共包和内部包的 Provider 与组件。

## 公开入口

| 入口 | 内容 |
| --- | --- |
| 根入口 | `UiProvider`、`StudioProvider`、配置与服务集合类型 |
| `/console` | `ConsoleWorkbench`、服务与设置类型 |
| `/schema` | `SchemaWorkbench`、`SchemaTree`、视图与树数据类型 |
| `/schema-editor` | `SchemaEditorWorkbench`、布局与草稿服务类型 |
| `/explorer` | `ExplorerWorkbench`、快照与设置服务、导航阻止契约 |
| `/editor` | `GqlEditor`、`GqlViewer`，只提供 `focus()` 的句柄 |
| `/contracts` | 快照、过滤、图标等纯 DTO、枚举及快照编解码函数 |
| `/locales/zh_CN`、`/locales/en_US` | 静态语言资源 |
| `/styles.css` | 组件必需样式 |

精确符号白名单在 `public-api.json`。不开放 Controller、Store、内部面板、全局状态、Monaco/ForceGraph 实例或源码通配路径。通用数据库协议来自 `studio-core/contracts`。

## 状态与生命周期约束

- Provider 按需创建领域状态，单独挂载 Provider 不初始化全部工作台。
- Console 的输入、结果、查询状态和快照关联随作用域保留；页面卸载释放编辑器与画布资源。
- Provider 卸载或 `scopeKey` 变化时取消请求并销毁状态，迟到响应不能写回新作用域或触发旧回调。
- 替换某域服务实例时重建该域状态；无关服务替换不重建当前工作台。
- Schema 变化清理 Console 查询上下文，并更新相关元数据和编辑服务。
- 每个 Provider 内每种工作台只保留一个活动实例，不新增 SchemaEditor 或 Explorer 的跨页面自动草稿。
- 公共事件传普通数据；查询选项仅包含取消信号和超时，不暴露内部错误展示控制参数。
- Console 到 Explorer 的快照关联在作用域内管理；删除快照时清理对应关联。
- Explorer 内部管理快照导航时，未保存内容由组件本地确认保护；受控 `snapshotId` 配合 `blocker` 时，由宿主处理导航拦截。宿主提供的 `blocker` 也用于离开 Explorer 的外部导航。
- `UiProvider` 默认关闭全局 CSS baseline，弹窗状态归实例所有；Monaco 主题仍为页面级。

## 开发检查

```sh
pnpm build:studio-ui
pnpm --filter @vesoft-inc/studio-ui lint:types
pnpm --filter @vesoft-inc/studio-ui test
pnpm --filter @vesoft-inc/studio-ui check:boundaries --dist
pnpm --filter @vesoft-inc/studio-ui check:api
```

构建用于仓库内的声明、资源和依赖边界验证。API 报告保存在 `etc/studio-ui.api.md`；变更公开接口时显式运行 `update:api` 并审查差异，CI 不自动接受报告更新。

组件准入要求：有明确复用场景、无需访问内部状态、接口可独立描述、生命周期可独立验收。优先补充工作台参数或事件，避免持续扩大内部子组件的公开范围。
