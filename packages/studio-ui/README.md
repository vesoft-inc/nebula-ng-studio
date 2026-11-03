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
| `/schema` | `SchemaList`、`GraphTypeList`、`GraphList`、`GraphInfo`、`CreateGraphDialog`、`SchemaTree` 及各自 Props |
| `/schema-editor` | `SchemaEditorWorkbench`、`SketchList`、布局与草稿服务类型 |
| `/explorer` | `SnapshotList`、`ExplorerGraph`、快照与设置服务、导航阻止契约 |
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
- Schema 与 Explorer 不保存页面选择或执行导航。宿主分别挂载列表、详情或编辑器，并处理 `onOpen`、`onView`、`onEdit`、`onBack` 等事件。
- `ExplorerGraph` 必须接收 `snapshotId`；通过 `onDirtyChange` 通知宿主。宿主负责拦截返回、切页、浏览器历史和关闭页面，并把 `blocker` 的 `state/proceed/reset` 传给画布中的保存/离开提示。组件没有内部导航或兜底阻止器。
- `UiProvider` 默认关闭全局 CSS baseline，弹窗状态归实例所有；Monaco 主题仍为页面级。

## 服务契约

### 快照与 Schema 归属

创建快照使用 `SnapshotCreateInput.schema_path`；`snapshots.read(id)` 和 `snapshots.list(...)` 返回的 `SnapshotRecord` 使用 `schemaPath`。后端字段不同时，由宿主服务映射。推荐详情始终返回快照实际所属的 `schemaPath`；该字段保留可选，仅用于兼容旧协议。

打开快照时，组件依次使用详情中的 `schemaPath`、已加载列表中同一快照的归属。如果两者都没有且当前 Schema 已知，会调用 `snapshots.list`，传入 `page: 1`、`pageSize: 1` 和以下 JSON 字符串作为 `filter`：

```json
{ "id": "snapshot-id", "schema_path": "/current-schema" }
```

服务必须同时按 `id` 和 `schema_path` 过滤。查询成功并返回对应快照，才能据此确认它属于当前 Schema，不能忽略过滤条件后返回同 ID 的任意记录。

| 场景 | 现有恢复能力 |
| --- | --- |
| 从 `/a` 下已加载的快照列表打开 | 即使旧详情缺少 `schemaPath`，仍可使用列表已确认的归属。 |
| 刷新分享链接，没有列表上下文 | 详情提供实际 `schemaPath` 时，可切换到对应 Schema 后恢复；详情缺少该字段时，只能通过上述查询验证当前 Schema 下的归属。 |

旧详情缺少归属时，组件不能自动发现任意其他 Schema 下的快照，也不会无条件把当前 Schema 当作快照归属。没有可验证归属时打开会失败；支持跨 Schema 的分享链接应让详情返回实际 `schemaPath`。

### 作用域与服务引用

`scopeKey` 是宿主提供的、不由组件解析的身份标识，应覆盖用户、数据库和连接会话。身份变化时更换该值，普通页面切换、主题或语言更新时保持不变。认证、快照、设置和布局的用户及数据库归属由宿主服务绑定，组件不会从 `scopeKey` 推导 API 地址或持久化 key。

`schemaPath` 表示宿主远程会话中已成功选中的 Schema。宿主主动切换时，先完成远程切换，再更新该 Props；只修改 Props 会同步组件状态，不会替宿主执行远程切换。工作台内部完成切换后，通过 `onSchemaChange` 通知宿主同步其 `schemaPath` 状态。

各域服务对象按引用识别。替换某域对象会取消并重建依赖它的领域状态，无关领域保持；仅重新创建外层 `services` 容器不会重建所有领域。避免在每次渲染中创建新的 `console`、`schema` 等对象，否则普通重新渲染也可能清空已有查询上下文。

下面的 `connection` 是宿主已有的会话对象，提供符合 `QueryExecutor` 的查询方法；普通重新渲染时保持其引用，身份变化时创建新对象并更换 `scopeKey`。示例只演示 Console 状态保留，不加载可选的图元数据。

```tsx
import { useMemo } from 'react';
import { StudioProvider, type QueryExecutor, type StudioServices } from '@vesoft-inc/studio-ui';
import { ConsoleWorkbench, type ConsoleServices } from '@vesoft-inc/studio-ui/console';

interface StudioAreaProps {
  connection: {
    scopeKey: string;
    execute: QueryExecutor;
    query: QueryExecutor;
  };
  schemaPath: string;
  onSchemaChange: (path: string) => void;
  page: 'console' | 'other';
}

export function StudioArea({ connection, schemaPath, onSchemaChange, page }: StudioAreaProps) {
  const consoleServices = useMemo<ConsoleServices>(
    () => ({
      execute: (gql, options) => connection.execute(gql, options),
      query: (gql, options) => connection.query(gql, options),
    }),
    [connection]
  );
  const services = useMemo<StudioServices>(() => ({ console: consoleServices }), [consoleServices]);

  return (
    <StudioProvider
      scopeKey={connection.scopeKey}
      services={services}
      schemaPath={schemaPath}
      onSchemaChange={onSchemaChange}
    >
      {page === 'console' ? <ConsoleWorkbench loadGraphMetadata={false} /> : <section>其他页面</section>}
    </StudioProvider>
  );
}
```

只切换 `page` 时，Provider 保持挂载，Console 的输入、结果和进行中的查询随作用域保留。实际路由也应把 Provider 放在页面切换不会卸载的位置；改变 `scopeKey`、Schema 或所依赖的服务实例时，按生命周期约束清理旧上下文。

### 请求、取消与错误

宿主将 `QueryOptions.signal` 和 `queryTimeout` 传入已有请求实现。请求选项中的超时单位为毫秒，由宿主请求实现执行；Console 和 Explorer 设置中的查询超时单位为秒，组件在发起查询时转换。无需再添加请求客户端封装。

| 情况 | 服务约定与现有反馈 |
| --- | --- |
| 业务失败 | 保留非零 `code` 和 `message`，不要求统一转换为异常。Console 将业务错误记录到查询结果；部分其他操作有组件本地提示。 |
| 网络异常、超时等传输失败 | 可以 reject，也兼容既有宿主返回规范化错误响应的方式。Console 对未取消的 reject 记录控制台异常，不保证生成错误结果或统一显示 UI 错误。 |
| 主动取消 | 将 `signal` 转发到请求实现，不作为普通失败提示。公共作用域会拒绝失效或已取消请求的返回值，阻止其写回新作用域。 |

中止客户端请求不表示服务端操作已经撤销。需要取消服务端查询时，使用现有可选 `ConsoleServices.cancelQuery`；它与 `AbortSignal` 承担不同职责。

组件没有统一的异常转换或错误提示去重机制。宿主应结合所用工作台的既有反馈安排网络错误提示：例如 Console 的网络 reject 如需用户可见提示，由宿主处理；Explorer 打开、保存快照的异常已有本地错误提示，应避免宿主对同一次失败再次弹错。不要在通用请求拦截器中对所有非零响应或异常无差别显示提示。

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
