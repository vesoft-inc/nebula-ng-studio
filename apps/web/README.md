# Studio Web

## 页面与导航

Web 使用 TanStack 文件路由。`_app` 管理会话和 Shell，Schema 与 Explorer 各自在布局中持有共享资源。子路由直接组合列表、详情或画布，并把组件事件映射为导航。页签、编辑模式和结果格式由组件管理。

Router 从 `APP_CONFIG.basePath` 读取部署前缀。登录回跳保留应用内路径、查询参数和锚点。Explorer 有未保存更改时由宿主拦截离开。会话失效时绕过拦截，清理资源并返回登录页。

## 服务与验证

Web 管理登录、OAuth、连接、会话及错误提示。会话按身份和 Schema 复用编辑器服务，使布局写入能跨页面保持顺序。请求协议、持久化和错误处理见 [Studio Server 适配器](../../docs/agents/STUDIO-SERVER-ADAPTERS.md)。

开发、Vitest 和源码类型检查为 `@vesoft-inc/studio-ui/adapters/studio-server` 配置精确的源码映射。产物模式通过包的正式入口解析依赖。路由生成、Vite 构建和浏览器回归命令见[验证指南](../../docs/agents/VERIFICATION.md)。
