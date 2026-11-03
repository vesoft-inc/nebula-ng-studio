# Studio UI Internal

`@vesoft-inc/studio-ui-internal` 是 Studio 的私有 UI 实现包。`apps/web`、`apps/gui` 直接使用本包并随仓库同步升级；这些细粒度入口不承诺外部兼容。

Cloud 等外部系统使用 [`@vesoft-inc/studio-ui`](../studio-ui/README.md)。对外包在构建时纳入本包的必要实现，单独维护组件白名单和公开类型。不要在同一个应用树中混用两个包的组件与 Provider，也不要从内部包反向依赖对外包。

跨业务复用的基础组件、hooks、查询契约和工具统一放在 `src/shared`；业务组件按 `console`、`schema`、`explorer` 等领域组织。

## 业务入口

| 入口 | 可复用能力 |
| --- | --- |
| `/contracts` | 无 MobX、React、DOM 或图引擎类型依赖的数据契约、枚举及纯快照编解码 |
| `/provider` | `UiProvider`：主题、语言、弹窗依赖；支持接入宿主已有实例 |
| `/editor` | `GqlEditor`、`GqlViewer`：受控内容、图名称补全、提交/清空回调、高度配置 |
| `/console` | `ConsoleWorkbench`，以及可单独组合的 `ConsoleProvider`、`QueryComposer`、`QueryToolbar`、`QueryResultList`、`QueryResultCard` 和结果视图 |
| `/console/model` | `ConsoleController`、查询服务契约、Console 到 Explorer 的数据转换 |
| `/integrations/console-explorer` | 可选的 `ensureExplorerSnapshot`：查询结果快照的复用、重建与创建；由宿主注入服务并处理导航 |
| `/graph` | `GraphCanvas`、`GraphMinimap`、`GraphStylePanel`、节点/边样式按钮、标签、图标选择器 |
| `/graph/model` | `GraphWorkspaceStore`、编辑状态、过滤状态 |
| `/graph/data`、`/graph/utils` | 图数据类型、结果转换、DML、快照兼容工具；不初始化画布 |
| `/graph/resources` | `IconCatalog`、`GraphResourcesProvider`；内置图标可离线使用，远端管理由宿主注入 |
| `/schema`、`/schema/model` | 目录/图类型/图列表、详情、索引、统计、树与创建/删除弹窗；`SchemaController` 和服务契约 |
| `/schema-editor`、`/schema-editor/model` | `SchemaEditorWorkbench`、可视化画布、节点/边/标签表单与表格、DDL 预览、草稿列表；编辑器/画布状态和布局服务契约 |
| `/explorer`、`/explorer/model` | `ExplorerSession`、快照列表与卡片、探索画布、查询/过滤/属性面板、图编辑、快照弹窗与设置；`ExplorerController` 和快照服务契约 |
| `/shell` | `StudioShell`、`StudioHeader`、`StudioNavigation`、`UserMenu`、语言/主题切换、`LoginPage`、`ConnectionForm`、`ConnectionDialog` |
| `/settings` | 设置面板、默认值、可指定存储空间的 `useStorageSettings` |
| `/locales`、`/theme`、`/modal` | 中英文资源、主题和弹窗基础能力 |

完整工作台与小组件使用同一实现。业务入口不依赖应用路由；`/model` 用于非 React 接入。Web 的 Schema/Explorer 页面和 Web/GUI 的 Shell、Console 都是公共入口的实际消费方。

## 数据契约与运行时状态

MobX 保留在 controller、编辑器和画布内部。服务适配器、列表卡片和持久化边界使用 `/contracts`；高级 `/model` 入口继续提供运行时 controller，属于 MobX 集成接口。

| 类型 | 用途 |
| --- | --- |
| `SnapshotRecord` | 原始接口数据，`data` 是可选的 JSON 字符串；兼容旧接口缺少 `schemaPath` |
| `SnapshotMetadata` | 确认 Schema 归属后的元数据，不包含画布状态 |
| `SnapshotPayload` | 既有 JSON 格式：元素 ID 数组、实体索引、图片 URL 和普通过滤条件 |
| `FilterDefinition` | 普通过滤配置，不包含计算方法 |
| `IconGroupRecord`、`IconItemRecord` | 图标服务原始记录，不要求目录展示字段；类型和时间等接口元信息可由自定义适配器省略 |
| `IconGroupData`、`IconItemData` | 不依赖 MobX 的目录展示数据，包含图标集合、编辑标记或分类 |
| `GraphRuntimeState`、`OpenedSnapshot` | `/graph/model`、`/explorer/model` 的高级运行时数据，集合接受普通或 observable 实现 |
| `GraphHistoryFrame` | `/graph/model` 的历史记录类型；维持原有实体引用和索引复制策略 |

```ts
import {
  decodeSnapshotPayload,
  encodeSnapshotPayload,
  type SnapshotRecord,
} from '@vesoft-inc/studio-ui-internal/contracts';

function encodeAgain(record: SnapshotRecord): string | undefined {
  const payload = decodeSnapshotPayload(record.data);
  return payload ? encodeSnapshotPayload(payload) : undefined;
}
```

纯编解码不创建图片、响应式集合或画布实例；既有边 ID 迁移仍在解码阶段执行。图片和图对象引用仅在内部运行时适配层创建。转换发生在加载、保存和 Console 交接时，不进入拖拽或悬停的逐帧路径；属性值和枚举的编码保持原样。

恢复时使用实体索引的字符串键作为画布 ID，迁移后重复的边只绑定一次端点。原始实体数据 `data.value` 中的节点 ID、边端点值和属性值保持原编码。`/contracts` 的 JavaScript 构建产物通过 `studio-core/graph` 的 ESM 入口调用边 ID 纯工具，可在无需 TypeScript loader 的原生 ESM 进程中直接导入。

`IconCatalogService` 的列表方法返回 `IconGroupRecord`、`IconItemRecord`。`IconCatalog` 在目录边界创建响应式图标集合并补齐展示字段；远程图标缺少 `category` 时使用稳定的 `groupId`，已有自定义分类会保留。服务适配器无需伪造 `icons`、`editable` 或 `category`。

旧 `Snapshot`、`SnapshotData` 继续导出，分别表示 `OpenedSnapshot` 和 `GraphRuntimeState`，不表示服务端 JSON。读取通用运行时集合时使用 `Array.from()`；服务实现应切换到 `SnapshotRecord`。既有 `exportSnapshotTransfer` 函数、controller 的导入/导出实例方法仍可调用。

`check:boundaries` 直接在 ES 标准库环境下编译真实契约入口，并检查其完整声明依赖图；`--dist` 同时检查构建声明和公开导出文件，防止契约重新引入 UI、响应式运行时或 DOM 依赖。

## 宿主接入

应用入口引入一次样式：

```ts
import '@vesoft-inc/studio-ui-internal/styles.css';
```

完整 Console 的最小组合：

```tsx
import { UiProvider } from '@vesoft-inc/studio-ui-internal/provider';
import { ConsoleWorkbench, type ConsoleServices } from '@vesoft-inc/studio-ui-internal/console';

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

React 组件和自定义 Hook 通过 `@vesoft-inc/studio-ui-internal/modal` 的 `useModal()` 获取当前 `UiProvider` 提供的 `ModalStore`。HTTP 拦截器、会话等非 React 模块使用宿主统一的 `modalStore`，宿主将同一实例传入 `UiProvider`。

宿主负责实现 `ConsoleServices`：`execute` 用于用户查询和警告查询，`query` 用于图元数据查询。返回值使用 `@vesoft-inc/studio-core/contracts` 的 `ServerResponse<T>`。适配器应传递 `AbortSignal`；`queryTimeout` 单位是毫秒。GUI 的 HTTP header、token、服务地址和 Web 的 Server API 路径都在各自应用中处理。

可选的 `getSessionId`、`cancelQuery` 提供服务端取消；没有服务端取消能力时，停止操作仍会中止客户端请求并忽略迟到响应。

`ConsoleWorkbench` 默认持有自己的 controller，并在卸载或切换服务实例时清理。需要跨路由保留状态时传入 `controller`，由宿主在退出会话时调用 `clearConsole()`，不再使用时调用 `destroy()`。保持 `services` 引用稳定；切换引用表示切换查询上下文。

`sidebar` 可接入同一包的 `SchemaTree`，`emptyState` 可替换默认空态，`appearance.prompt` 控制提示符。`settings` / `onSettingsChange` 用于受控设置，`onExplore` 接入宿主导航。路由、登录、品牌配置和存储 key 都由应用管理。

需要自定义页面布局时，在 `UiProvider` 内使用 `ConsoleProvider`，共享同一个 controller 和 settings，再组合 `QueryComposer`、`QueryResultList`。完整工作台使用的也是这些组件。

`UiProvider` 可接收宿主的 theme、i18n、modalStore。显式传入或从父级 MUI ThemeProvider 继承普通 MUI 主题时，会按其明暗模式补齐缺失的 Vesoft 颜色，保留宿主已有的主题配置及颜色覆盖，不修改原主题。自定义 i18n 需要加载 `/locales` 导出的 `uiResources`；内置的 CSS baseline 使默认字体、字号和页面基线与 Studio 一致；嵌入已有主题应用时可设 `cssBaseline={false}`。宿主已经渲染全局弹窗时设置 `renderGlobalModal={false}`。Monaco 的主题属于同一页面的全局设置，因此同一页面上的编辑器需使用一致的主题模式。

## Schema 与 Schema Editor

```tsx
import { SchemaProvider, GraphTypeList } from '@vesoft-inc/studio-ui-internal/schema';

<SchemaProvider value={schemaController}>
  <GraphTypeList onView={openGraphType} onEdit={editGraphType} onCreate={createGraphType} />
</SchemaProvider>;
```

`SchemaServices.execute` 提供 GQL 查询。可选 `switchSchema` 处理宿主服务端会话切换，未提供时执行 `SESSION SET SCHEMA`；可选 `importDataset` 和 `sweepLayouts` 提供示例数据导入与过期布局清理。未配置导入或草稿服务时隐藏对应操作。

Schema 页面由应用组合：目录、图类型、图、详情、草稿、编辑器分别挂载，不提供库内视图分发和侧栏导航。Web 的 TanStack 文件路由位于 `apps/web/src/routes`，Schema 布局和服务装配放在 `routes/_app/_schema` 的对应目录。创建图按钮通过 `onCreate` 通知宿主显示 `CreateGraphDialog`，未提供回调时隐藏。

仅使用编辑器时导入 `SchemaEditorWorkbench`，传入 `services`、`mode`、`graphTypeName` 或 `sketchId`，通过 `onSaved`、`onBack`、`onEdit`、`onView` 处理后续行为。`SchemaEditorServices` 包含 `execute`，以及可选的 `layouts` 和 `sketches`。布局服务接收图类型名称和节点坐标；账号、数据库地址、Schema 路径和存储 key 由宿主适配器绑定。切换这些身份时必须提供新的服务实例，避免旧编辑器的清理写入落到新身份。Web 的 `services/schemaEditor.ts` 展示了这种绑定方式。

高级编辑状态通过 `selectItem()` 更新选中项，通过 `commitNodeChanges()`、`commitEdgeChanges()` 提交修改；不再通过选中项的 reaction 隐式写回。现有实时编辑面板在 `onChange` 中显式提交，弹窗在确认时提交、取消时不提交。`updateNodeType()`、`updateEdgeType()` 和旧 `setActiveItem()` 保留为兼容入口；旧 setter 的选择并写回行为由方法内显式完成。新代码应分开调用选择和提交方法。

自定义组合时，`SchemaProvider` 绑定一个 `SchemaController`，可组合 `SchemaTree`、`SchemaList`、`GraphTypeList`、`GraphList`、`GraphInfo`、`GraphIndexes` 和 `GraphStatistics`。`SchemaEditorProvider` 绑定一个 `SchemaEditorController`，可组合 `SchemaEditor`、`SchemaVisualEditor`、`NodeTypeTable/Form/Dialog`、`EdgeTypeTable/Form/Dialog`、`LabelTable/Dialog`、`DdlPreview` 和 `SketchList`。手动组合画布与表单前调用 controller 的 `initSchemaStore()`，卸载时调用 `destroy()`。

创建图与五类索引表单、DDL 弹窗、删除确认弹窗也从 `/schema` 导出；索引表单在 `IndexQueryProvider` 中共享查询依赖。

`useSchemaTreeBindings` 复用树节点加载、Schema 切换与创建后的列表刷新。它显式接收 `SchemaController`，在 `UiProvider` 内使用；不要求 `SchemaProvider`，也不读取应用全局 store。在 `observer` 组件内调用，以响应 controller 的状态变化：

```tsx
import { SchemaTree, useSchemaTreeBindings } from '@vesoft-inc/studio-ui-internal/schema';

const bindings = useSchemaTreeBindings({
  controller: schemaController,
  showDetail: true,
  collapsed: false,
  onSchemaChange: setCurrentSchemaPath,
  onSchemaCreated: openSchemaList,
  onCreateGraphType: openGraphTypeEditor,
  onViewAllSchemas: openSchemaList,
});

<SchemaTree {...bindings} onReady={() => void schemaController.getSchemas()} />;
```

hook 不主动初始化数据，宿主可通过 `onReady` 懒加载，也可在共享布局初始化目录。切换成功后才通知 `onSchemaChange` 并显示成功消息。创建成功后尝试刷新列表，再通知 `onSchemaCreated`；刷新异常不会将创建判为失败。组件卸载或 controller 更换后，旧创建流程不会再发起列表刷新或触发完成回调。导航由回调决定：Console 切换 Schema 后留在当前页，Schema 管理页返回图类型列表。

## Explorer

```tsx
import { ExplorerSession, SnapshotList } from '@vesoft-inc/studio-ui-internal/explorer';

<ExplorerSession services={explorerServices} schemaServices={schemaServices}>
  <SnapshotList onOpen={openSnapshot} />
</ExplorerSession>;
```

旧版快照接口未返回 `schemaPath` 时，列表项使用此次 `schema_path` 筛选确定的归属。直接打开快照会先按 `id` 和当前 Schema 查询列表确认归属；无法确认时拒绝恢复，避免在错误的 Schema 下加载或修改图数据。

`ExplorerController.openSnapshot()` 显式负责读取、确认并切换 Schema、解码、应用快照和启动图类型元数据加载。`workspace.restoreSnapshot()` 只应用状态并记录历史，元数据加载通过 `loadGraphTypeDetails()` 显式启动；元数据 setter 不触发查询或重新恢复数据。旧 `initSnapShot()` 仍组合恢复和元数据加载。替换快照或销毁工作区会使旧元数据结果失效。

画布同步与选择高亮的 reaction 由画布实例管理，过滤订阅由 GraphStore 管理，目录同步由 SchemaController 管理；布局自动保存由 `useLayoutPersistence` 的 effect 管理订阅、计时器及卸载时的提交。这些剩余订阅的计算逻辑保持原样。

`ExplorerServices` 注入 `execute` 和快照的 `list/create/read/update/delete`；可选 `settings.load/save` 接入远端或本地存储，`snapshotVersion` 标记导出文件版本。`onSnapshotDeleted` 用于清理宿主的 Console 结果映射，`onSchemaChanged` 用于同步宿主会话。Web 的 `services/explorerWorkbench.ts` 负责服务端路径、用户名和配置 key。

`ExplorerSession` 只初始化资源、提供上下文和释放自有实例，不选择页面。应用共享布局可以将 `Outlet` 作为 children；列表路由渲染 `SnapshotList`，详情路由渲染 `ExplorerGraph`。`SnapshotList.onOpen(id)` 和 `ExplorerGraph.onBack()` 仅通知宿主。宿主根据 `onDirtyChange` 拦截路由和浏览器关闭，并传入 `blocker`（`state/proceed/reset`）。Web 在 `routes/_app/explorer/snapshots/-Snapshot.tsx` 适配 TanStack `useBlocker`。

自定义布局时使用 `ExplorerProvider`，组合 `SnapshotList`、`SnapshotCard`、`ExplorerGraph` 或更细的 `ExplorerHeader`、`ExplorerCanvas`、`ExplorerSidePanels`、查询/过滤/属性面板及图编辑弹窗。传入 controller 时由宿主管理其 `destroy()`；默认创建的 controller 会随工作台卸载清理。独立快照、请求、画布和设置状态属于对应实例。外部传入的 SchemaController 生命周期由宿主管理。

远程图标管理通过 `GraphResourcesProvider` 的图标服务与 `allowRemoteIconManagement` 显式启用；未启用时使用内置资源。

## Console 与 Explorer 集成

```ts
import { ensureExplorerSnapshot } from '@vesoft-inc/studio-ui-internal/integrations/console-explorer';

const snapshot = await ensureExplorerSnapshot({
  result,
  graph,
  consoleController,
  schemaController,
  snapshots: snapshotServices,
  snapshotVersion: appVersion,
  schemaPathFallback: currentSessionSchema,
});

if (snapshot) openSnapshot(snapshot.snapshotId);
```

`snapshots` 只需实现现有 `SnapshotServices` 的 `read/create`。函数复用有效快照，仅在服务明确返回 `HttpResCode.ErrNotFound` 时重建；新快照会补齐图类型和 Schema，并记录 Console 结果与快照的关联。图数据在等待元数据前同步序列化。普通 Console 使用者无需配置此能力。

没有可探索数据时返回 `null`；服务失败则抛出错误，缺少错误详情时 `Error.message` 为空，供宿主使用本地化兜底文案。宿主统一处理 HTTP 错误展示、版本来源、controller 生命周期和快照打开方式。Web 的 `routes/_app/console/-exploreResult.ts` 仅做这些适配。

集成入口复用 Console 工具和独立的快照序列化函数，不加载 Explorer controller；业务模块不反向依赖集成入口。既有的 `exportSnapshotTransfer` 导出和 controller 实例方法继续可用。

## Shell 与连接界面

`StudioShell` 组合 header、业务内容和 overlays；`StudioHeader` 可传入 logo、导航项、用户信息、版本和语言/主题/退出回调。导航项接受 `key/label/href`；`onNavigate` 由宿主接到自己的路由。Web 使用 64px 页头，GUI 使用 56px 页头及连接状态插槽。

`LoginPage` 和 `ConnectionDialog` 复用 `ConnectionForm` 与 `ConnectionFields`，通过 `onSubmit(values, { sso })` 交给宿主鉴权。品牌图片、默认地址、版本、SSO 可用性及登录成功后的导航均由应用提供。表单提交只作用于当前实例，异步提交期间禁止重复请求。

## 构建与验证

```sh
pnpm --filter @vesoft-inc/studio-core build
pnpm --filter @vesoft-inc/studio-core check:boundaries --dist
pnpm --filter @vesoft-inc/studio-ui-internal build
pnpm --filter @vesoft-inc/studio-ui-internal test
pnpm --filter @vesoft-inc/studio-ui-internal check:boundaries --dist
STUDIO_UI_INTERNAL_DIST=1 pnpm --filter nebula-studio exec vite build
STUDIO_UI_INTERNAL_DIST=1 pnpm --filter nebula-gui exec vite build
```

开发时 Web/GUI 使用 `source` 条件解析源码；默认包入口使用 `dist`，包含声明、样式、图片、图标和 Monaco worker。打包器需支持 ES modules、CSS、`new URL(..., import.meta.url)` 和 Monaco 的 ESM 依赖。组件包依赖同一工作区的 `@vesoft-inc/studio-core`、`@vesoft-inc/force-graph`，跨仓库接入时也需提供这两个包及声明的 peer dependencies。

旧 Web 路径中的兼容文件只转导出公共入口，供应用适配器及原有调用方使用；新增代码直接从本包的业务入口导入。

## studio-core 边界

通用 Schema、图数据和 GQL 协议使用 `@vesoft-inc/studio-core/contracts`，图身份及类型解析使用 `/graph`。快照、过滤条件和图标 DTO 继续由组件库 `/contracts` 提供，旧组件类型入口继续重导出通用协议类型。`IProperty`、节点/边编辑器类和展示常量留在组件库，协议解析器仅返回无编辑器身份的 `PropertyTypeDefinition`。

`ConsoleResult` 的 `destroy` 生命周期和执行计划的分组、展示名、耗时占比属于组件层，从 `/console` 或 `/console/model` 导入。执行计划布局使用原始 `GQLResultPlanInfo` 的展示副本，不修改服务返回的协议对象。

Web / GUI 各自创建 Axios 客户端，并使用 core 的共享响应解析、取消信号、浏览器存储和加密能力。路由创建、销毁与导航由 Web / GUI 宿主管理；Web 启动时向会话逻辑注入导航回调，并在销毁或 HMR 时解除绑定。组件依赖查询/导航端口，不导入 Axios 客户端或路由实现。

通用 UUID、JSONBig、GQL 名称及模式工具由 core 统一实现，组件库原工具入口保留转导出。编辑器默认样式 `LINE_STYLE`、`ToolNodeColor` 可从 `/schema/types`（以及 `/schema/model`、`/schema`）导入。

CSV 下载由组件库的 `shared/download.ts` 实现，供探索页整图导出与选中实体导出共用，并从 `/utilities` 导出 `downloadCSVFiles`。CSV 转换、BOM、文件名、浏览器下载及错误提示由该工具处理。凭据加解密协议继续由 `studio-core/crypto` 提供。

HTTP 客户端始终返回 `AxiosResponse`。Web services 按接口声明 `ServerResponse<T>` 并取出响应体；GUI services 按 REST 协议声明响应，规范化查询结果后交给组件查询契约。错误提示选项和 Axios 配置扩展属于各自宿主。
