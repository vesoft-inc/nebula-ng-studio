# UI Components

Studio 的基础 UI 和业务组件。`apps/web`、`apps/gui` 是实际接入方，本仓库不另建示例应用。

跨业务复用的基础组件、hooks、查询契约和工具统一放在 `src/shared`；业务组件按 `console`、`schema`、`explorer` 等领域组织。

## 业务入口

| 入口 | 可复用能力 |
| --- | --- |
| `/provider` | `UiProvider`：主题、语言、弹窗依赖；支持接入宿主已有实例 |
| `/editor` | `GqlEditor`、`GqlViewer`：受控内容、图名称补全、提交/清空回调、高度配置 |
| `/console` | `ConsoleWorkbench`，以及可单独组合的 `ConsoleProvider`、`QueryComposer`、`QueryToolbar`、`QueryResultList`、`QueryResultCard` 和结果视图 |
| `/console/model` | `ConsoleController`、查询服务契约、Console 到 Explorer 的数据转换 |
| `/graph` | `GraphCanvas`、`GraphMinimap`、`GraphStylePanel`、节点/边样式按钮、标签、图标选择器 |
| `/graph/model` | `GraphWorkspaceStore`、编辑状态、过滤状态 |
| `/graph/data`、`/graph/utils` | 图数据类型、结果转换、DML、快照兼容工具；不初始化画布 |
| `/graph/resources` | `IconCatalog`、`GraphResourcesProvider`；内置图标可离线使用，远端管理由宿主注入 |
| `/schema`、`/schema/model` | `SchemaWorkbench`、目录/图类型/图列表、详情、索引、统计、树与创建/删除弹窗；`SchemaController` 和服务契约 |
| `/schema-editor`、`/schema-editor/model` | `SchemaEditorWorkbench`、可视化画布、节点/边/标签表单与表格、DDL 预览、草稿列表；编辑器/画布状态和布局服务契约 |
| `/explorer`、`/explorer/model` | `ExplorerWorkbench`、快照列表与卡片、探索画布、查询/过滤/属性面板、图编辑、快照弹窗与设置；`ExplorerController` 和快照服务契约 |
| `/shell` | `StudioShell`、`StudioHeader`、`StudioNavigation`、`UserMenu`、语言/主题切换、`LoginPage`、`ConnectionForm`、`ConnectionDialog` |
| `/settings` | 设置面板、默认值、可指定存储空间的 `useStorageSettings` |
| `/locales`、`/theme`、`/modal` | 中英文资源、主题和弹窗基础能力 |

完整工作台与小组件使用同一实现。业务入口不依赖应用路由；`/model` 用于非 React 接入。Web 的 Schema/Explorer 页面和 Web/GUI 的 Shell、Console 都是公共入口的实际消费方。

## 宿主接入

应用入口引入一次样式：

```ts
import '@vesoft-inc/ui-components/styles.css';
```

完整 Console 的最小组合：

```tsx
import { UiProvider } from '@vesoft-inc/ui-components/provider';
import { ConsoleWorkbench, type ConsoleServices } from '@vesoft-inc/ui-components/console';

function QueryPage({ services }: { services: ConsoleServices }) {
  return (
    <UiProvider locale="zh_CN">
      <div style={{ height: '100%' }}>
        <ConsoleWorkbench services={services} />
      </div>
    </UiProvider>
  );
}
```

宿主负责实现 `ConsoleServices`：`execute` 用于用户查询和警告查询，`query` 用于图元数据查询。返回值使用 `@vesoft-inc/utils` 的 `ServerResponse<T>`。适配器应传递 `AbortSignal`；`queryTimeout` 单位是毫秒。GUI 的 HTTP header、token、服务地址和 Web 的 Server API 路径都在各自应用中处理。

可选的 `getSessionId`、`cancelQuery` 提供服务端取消；没有服务端取消能力时，停止操作仍会中止客户端请求并忽略迟到响应。

`ConsoleWorkbench` 默认持有自己的 controller，并在卸载或切换服务实例时清理。需要跨路由保留状态时传入 `controller`，由宿主在退出会话时调用 `clearConsole()`，不再使用时调用 `destroy()`。保持 `services` 引用稳定；切换引用表示切换查询上下文。

`sidebar` 可接入同一包的 `SchemaTree`，`emptyState` 可替换默认空态，`appearance.prompt` 控制提示符。`settings` / `onSettingsChange` 用于受控设置，`onExplore` 接入宿主导航。路由、登录、品牌配置和存储 key 都由应用管理。

需要自定义页面布局时，在 `UiProvider` 内使用 `ConsoleProvider`，共享同一个 controller 和 settings，再组合 `QueryComposer`、`QueryResultList`。完整工作台使用的也是这些组件。

`UiProvider` 可接收宿主的 theme、i18n、modalStore。自定义 i18n 需要加载 `/locales` 导出的 `uiResources`；内置的 CSS baseline 使默认字体、字号和页面基线与 Studio 一致；嵌入已有主题应用时可设 `cssBaseline={false}`。宿主已经渲染全局弹窗时设置 `renderGlobalModal={false}`。Monaco 的主题属于同一页面的全局设置，因此同一页面上的编辑器需使用一致的主题模式。

## Schema 与 Schema Editor

```tsx
import { SchemaWorkbench } from '@vesoft-inc/ui-components/schema';

<SchemaWorkbench services={schemaServices} editorServices={editorServices} />;
```

`SchemaServices.execute` 提供 GQL 查询。可选 `switchSchema` 处理宿主服务端会话切换，未提供时执行 `SESSION SET SCHEMA`；可选 `importDataset` 和 `sweepLayouts` 提供示例数据导入与过期布局清理。未配置导入或草稿服务时隐藏对应操作。

`SchemaWorkbench` 默认管理页面状态；传入 `view` 和 `onViewChange` 可以对接宿主路由。`SchemaView` 描述目录、图类型、图、图详情、编辑器和草稿视图，包含原始名称，不包含 URL。`onSchemaChange` 用于同步宿主当前会话信息。Web 在 `pages/SchemaManager` 中完成 URL 编解码与导航。

仅使用编辑器时导入 `SchemaEditorWorkbench`，传入 `services`、`mode`、`graphTypeName` 或 `sketchId`，通过 `onSaved`、`onBack`、`onEdit`、`onView` 处理后续行为。`SchemaEditorServices` 包含 `execute`，以及可选的 `layouts` 和 `sketches`。布局服务接收图类型名称和节点坐标；账号、数据库地址、Schema 路径和存储 key 由宿主适配器绑定。切换这些身份时必须提供新的服务实例，避免旧编辑器的清理写入落到新身份。Web 的 `services/schemaEditor.ts` 展示了这种绑定方式。

自定义组合时，`SchemaProvider` 绑定一个 `SchemaController`，可组合 `SchemaSidebar`、`SchemaList`、`GraphTypeList`、`GraphList`、`GraphInfo`、`GraphIndexes` 和 `GraphStatistics`。`SchemaEditorProvider` 绑定一个 `SchemaEditorController`，可组合 `SchemaEditor`、`SchemaVisualEditor`、`NodeTypeTable/Form/Dialog`、`EdgeTypeTable/Form/Dialog`、`LabelTable/Dialog`、`DdlPreview` 和 `SketchList`。手动组合画布与表单前调用 controller 的 `initSchemaStore()`，卸载时调用 `destroy()`。

创建图与五类索引表单、DDL 弹窗、删除确认弹窗也从 `/schema` 导出；索引表单在 `IndexQueryProvider` 中共享查询依赖。

## Explorer

```tsx
import { ExplorerWorkbench } from '@vesoft-inc/ui-components/explorer';

<ExplorerWorkbench
  services={explorerServices}
  schemaServices={schemaServices}
/>;
```

`ExplorerServices` 注入 `execute` 和快照的 `list/create/read/update/delete`；可选 `settings.load/save` 接入远端或本地存储，`snapshotVersion` 标记导出文件版本。`onSnapshotDeleted` 用于清理宿主的 Console 结果映射，`onSchemaChanged` 用于同步宿主会话。Web 的 `services/explorerWorkbench.ts` 负责服务端路径、用户名和配置 key。

默认使用内部页面状态；`snapshotId={null}` 表示快照列表，字符串表示打开指定快照。搭配 `onSnapshotChange` 即可接入路由。宿主路由有离开保护时传入 `blocker`（`state/proceed/reset`）；内部导航自动提供未保存提示和保存后离开操作。Web 的适配器把 React Router 的 blocker 接到此契约。

自定义布局时使用 `ExplorerProvider`，组合 `SnapshotList`、`SnapshotCard`、`ExplorerGraph` 或更细的 `ExplorerHeader`、`ExplorerCanvas`、`ExplorerSidePanels`、查询/过滤/属性面板及图编辑弹窗。传入 controller 时由宿主管理其 `destroy()`；默认创建的 controller 会随工作台卸载清理。独立快照、请求、画布和设置状态属于对应实例。外部传入的 SchemaController 生命周期由宿主管理。

远程图标管理通过 `GraphResourcesProvider` 的图标服务与 `allowRemoteIconManagement` 显式启用；未启用时使用内置资源。

## Shell 与连接界面

`StudioShell` 组合 header、业务内容和 overlays；`StudioHeader` 可传入 logo、导航项、用户信息、版本和语言/主题/退出回调。导航项接受 `key/label/href`；`onNavigate` 由宿主接到自己的路由。Web 使用 64px 页头，GUI 使用 56px 页头及连接状态插槽。

`LoginPage` 和 `ConnectionDialog` 复用 `ConnectionForm` 与 `ConnectionFields`，通过 `onSubmit(values, { sso })` 交给宿主鉴权。品牌图片、默认地址、版本、SSO 可用性及登录成功后的导航均由应用提供。表单提交只作用于当前实例，异步提交期间禁止重复请求。

## 构建与验证

```sh
pnpm --filter @vesoft-inc/ui-components build
pnpm --filter @vesoft-inc/ui-components test
pnpm --filter @vesoft-inc/ui-components check:boundaries --dist
UI_COMPONENTS_DIST=1 pnpm --filter nebula-studio exec vite build
UI_COMPONENTS_DIST=1 pnpm --filter nebula-gui exec vite build
```

开发时 Web/GUI 使用 `source` 条件解析源码；默认包入口使用 `dist`，包含声明、样式、图片、图标和 Monaco worker。打包器需支持 ES modules、CSS、`new URL(..., import.meta.url)` 和 Monaco 的 ESM 依赖。组件包依赖同一工作区的 `@vesoft-inc/utils`、`@vesoft-inc/force-graph`，跨仓库接入时也需提供这两个包及声明的 peer dependencies。

旧 Web 路径中的兼容文件只转导出公共入口，供应用适配器及原有调用方使用；新增代码直接从本包的业务入口导入。
