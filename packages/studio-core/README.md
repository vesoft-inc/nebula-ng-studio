# Studio Core

`@vesoft-inc/studio-core` 是 Web、GUI 和 UI Components 共用的协议与基础能力包。它不依赖应用、React、MobX、路由实现或组件库。

## 入口

| 入口 | 职责 | 环境 |
| --- | --- | --- |
| 根入口 | `createUuid`、`safeArray`、`groupArray`、`hexToRgba` | 无 DOM 依赖 |
| `/contracts` | 响应、Schema、GQL、图数据协议、属性类型定义、领域枚举 | 无 DOM / React / MobX 依赖 |
| `/graph` | 边身份、GQL 名称转义、类型参数解析、DECIMAL、JSONBig | 无 DOM / React / MobX 依赖 |
| `/request` | `parseResponseBody`、`RequestQueue`、取消信号组合 | HTTP / AbortSignal |
| `/browser` | `LocalStorageUtil` | 浏览器 |
| `/crypto` | 现有凭据加解密协议 | Web Crypto、Base64 API |

根入口不聚合其余入口。协议和纯工具不会因为导入入口而加载 HTTP、路由或浏览器模块。

```ts
import { createUuid } from '@vesoft-inc/studio-core';
import { PropertyDataType, type ServerResponse } from '@vesoft-inc/studio-core/contracts';
import { parsePropertyDataType } from '@vesoft-inc/studio-core/graph';
import { parseResponseBody, mergeAbortSignals } from '@vesoft-inc/studio-core/request';
```

## 职责边界

`parsePropertyDataType` 返回纯数据 `PropertyTypeDefinition`，不包含编辑器 ID、样式或克隆方法。节点/边编辑器模型、展示常量和带 `destroy` 的 `ConsoleResult` 由 UI Components 维护。快照、过滤及图标 DTO 也留在 UI Components 的 `/contracts` 入口。

`GQLResultPlanInfo` 只表示服务协议。分组、展示名和耗时占比由组件层的 `PlanNodeData` 承载，展示计算不修改原始查询结果。

Web / GUI 宿主负责创建、销毁路由和应用会话绑定；React 组件通过宿主的 RouterProvider 使用路由。Web 会话逻辑在应用启动时接收导航回调，并在销毁时解除绑定。

HTTP 路径、请求头、鉴权、会话、导航决策和服务实例由宿主配置，core 不执行应用启动逻辑。`/request` 的响应体解析函数由两端共享；Web / GUI 各自通过 `axios.create()` 配置请求客户端、拦截器和会话生命周期。core 不依赖 Axios，也不扩展其全局配置类型。`/crypto` 保留既有后端兼容协议。

## 构建与验证

旧 utils 包已迁移为 `packages/studio-core`，包名与生产调用方已统一，未提供旧包别名。原根入口的领域与平台 API 改用上表的子入口。

```sh
pnpm --filter @vesoft-inc/studio-core test
pnpm --filter @vesoft-inc/studio-core lint:types
pnpm --filter @vesoft-inc/studio-core build
pnpm --filter @vesoft-inc/studio-core check:boundaries --dist
```

构建产物为真实 ESM `.js` 和 `.d.ts`，默认 `import` / `types` 指向 `dist`。开发工具通过 `source` 条件选择源码。依赖构建顺序为 core → UI Components → Web / GUI，Turbo 已声明此顺序；直接执行包脚本时需先构建其依赖。

边界检查直接编译根入口、协议和图工具的真实入口，在 ES 标准库环境下追踪完整类型依赖图，并覆盖 Bundler / NodeNext 两种解析模式；平台入口使用其对应环境检查。`--dist` 同时检查构建声明和公开导出文件。CI 同时执行源码和产物的边界检查。

源码入口所需的第三方类型声明随 dependencies 安装；消费方启用 `source` 条件时，无需补装本包的开发依赖。
