# 实时推送

基于 Socket.IO，只有**服务端到浏览器**一个方向。登录后每个标签页自动建立一条连接，令牌更新后自动重连，退出登录时自动断开，业务代码不需要自己管理连接。

目前已经在用实时推送的地方：站内信铃铛、公告发布和撤回、强制下线（对方马上被踢出）、审批待办提醒。

## 服务端发送

在任何 service 中直接注入 `RealtimeService`：

| 方法 | 发给谁 |
| --- | --- |
| `toUser(userId, msg)` | 这个用户所有打开的标签页 |
| `toUsers(userIds, msg)` | 多个用户（同一个连接只收到一次） |
| `toUserType(type, msg)` | 某一类用户 |
| `broadcast(msg)` | 所有已登录的用户 |

```ts
this.realtime.toUser(userId, { type: RT.notifyNew, payload: { id, title } })
```

消息格式是 `{ type, payload }`，类型定义在共享包 `packages/shared/src/common/realtime.ts` 中，前后端共用，`payload` 的结构有类型检查。

## 前端订阅

```ts
import { onRealtime } from '@/core/realtime/socket'
import { RT } from '@qiwu/shared'

onRealtime(RT.wfTask, ({ instanceId }) => {
  reload()
})
```

在组件里调用时，组件卸载后会自动取消订阅。

示例页面在 **系统工具 → 生成示例 → 实时推送示例**，可以按用户、按角色或者向全员发送消息，并查看收到的消息记录。

## 使用规则

- **事务提交之后再推送**。如果在事务内推送，对方收到提示后去读数据，可能读到还没提交、甚至已经回滚的数据。
- **推送只是提醒，不是数据通道**。消息里只带 id 和显示需要的最少字段，对方需要详情时，再通过接口按自己的权限读取。
- **收件人由服务端决定**。不要直接使用请求体里传来的用户 id。
- **发出即结束，不保证送达**。不在线的用户收不到，之后也不会补发。必须送达的内容要先存进数据库（比如站内信），推送只负责提醒"有新内容"。

## 部署注意

反向代理要把 `/socket.io/` 按 WebSocket 方式转发（见[部署](/guide/deploy)）。服务端会校验浏览器的 `Origin`，只接受本站或者 `CORS_ORIGIN` 中列出的来源。
