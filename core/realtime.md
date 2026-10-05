# 在代码中推送实时消息

这一页讲怎么从服务端推送一条实时消息、怎么在页面里接收。实时推送能做什么、用户看到的效果，见[实时推送](/features/realtime)。

## 先了解几个概念

- **连接**：登录后，每个打开的浏览器标签页和服务端之间有一条 Socket.IO 连接（Socket.IO 是一个基于 WebSocket 的库，WebSocket 是一种服务端可以主动给浏览器发消息的连接）。路径是 `/socket.io`，只用 WebSocket 方式传输。移动端在前台时也有一条，见"[移动端（uni-app）](#移动端-uni-app)"；
- **方向**：只有**服务端 → 浏览器**。浏览器只接收，不能通过这条连接向服务端发送任何东西；
- **消息**：所有推送都走同一个 Socket.IO 事件 `message`（常量 `REALTIME_EVENT`），内容是一个"信封" `{ type, payload }`。前端按 `type` 把它交给对应的处理函数；
- **房间**（room）：Socket.IO 里的一组连接，发给一个房间，房间里的每条连接都会收到。连接通过验证后，服务端把它加入三个房间，浏览器不能自己选择或加入其他房间：

```ts
// apps/server/src/core/realtime/realtime.service.ts
export const rooms = {
  user: (userId: number) => `user:${userId}`,    // 这个用户的所有连接（多个标签页）
  session: (sid: string) => `sid:${sid}`,        // 这一次登录（会话）的连接，强制下线时用
  userType: (type: string) => `type:${type}`,    // 同一用户类型的所有连接
}
```

连接由前端统一管理（下文"[前端：订阅推送](#前端-订阅推送)"），业务代码不需要也不应该自己创建连接。

## 服务端：RealtimeService

`CoreRealtimeModule` 是全局模块，在任何服务的构造函数里直接注入 `RealtimeService`，不需要导入模块：

| 方法 | 发给谁 |
| --- | --- |
| `toUser(userId, msg)` | 这个用户所有打开的标签页（房间 `user:{id}`） |
| `toUsers(userIds, msg)` | 多个用户。同一条连接只收到一次；空数组什么都不发 |
| `toUserType(userType, msg)` | 某一类用户（房间 `type:{userType}`）。用户类型是 `iam_user.user_type`，默认都是 `admin` |
| `broadcast(msg)` | 所有已登录的连接 |
| `onlineUsers(userIds?)` | 不是发送：返回整个部署（所有实例）里现在有连接的**不同用户数**（在给定的 id 里，或者全部）。在发送前调用，就是"有多少人收到" |

- 这几个发送方法都是**同步**的，发出去就结束，不等待、也不确认对方收到。部署了多个实例时，消息会经 Redis 送到连在其他实例上的连接，见"[多实例](#多实例)"；
- `onlineUsers` 要询问所有实例，最多等 5 秒，得到的是那一刻的快照。只用来统计（比如示例页的"N 位在线用户收到"），不要在逐条发送业务消息的路径上调用；
- 服务还没启动网关时（命令行脚本、种子、迁移），所有方法都什么也不做，调用方不需要判断；
- 还有一个 `endSessions()`，只给 `SessionRevoker`（结束会话的统一入口）用，业务代码不要调用。

公告发布或撤回之后，通知所有人的铃铛重新加载：

```ts
// apps/server/src/modules/platform/messaging/bulletin/bulletin.service.ts（节选）
async publish(id: number, published: boolean): Promise<void> {
  const changed = await this.txHost.withTransaction(async () => {
    await this.lockScopedIds([id])
    const row = await this.repo.findOneByOrFail({ id })
    if (row.published === published) return false
    await this.repo.update(id, { published, publishedAt: published ? new Date() : null })
    return true
  })
  // 事务已经提交，再推送
  if (changed) this.push(published ? 'published' : 'withdrawn', [id])
}

private push(action: RealtimePayloads['notify:bulletin']['action'], ids: number[]) {
  this.realtime.broadcast({ type: RT.notifyBulletin, payload: { action, ids } })
}
```

## 现有的推送类型

类型只在共享包的 `packages/shared/src/common/realtime.ts` 里定义一次，前后端共用：

| 类型 | 常量 | 载荷 | 发给谁 | 谁发的 |
| --- | --- | --- | --- | --- |
| `session:kicked` | `RT.sessionKicked` | `{ sid }` | 被管理员强制下线的会话，随后断开连接 | `SessionRevoker` |
| `notify:new` | `RT.notifyNew` | `{ id, title }` | 站内信的收件人 | `inbox.channel.ts` |
| `notify:bulletin` | `RT.notifyBulletin` | `{ action, ids }` | 所有已登录的连接 | `bulletin.service.ts` |
| `wf:task` | `RT.wfTask` | `{ instanceId }` | 待办有变化的用户（分配、办理、取消、转办等） | `wf-notify.ts` |
| `demo:message` | `RT.demoMessage` | `{ from: { id, name }, text, at }` | 示例页选定的用户、角色成员或全员 | `modules/demo/realtime` |

信封是带类型检查的：`type` 写 `RT.notifyNew`，`payload` 就必须是 `{ id: number; title: string }`，写错了编译不通过。

## 新增一种推送

下面用一个假设的例子"订单已发货"（模板里没有订单模块）说明完整步骤。

### 第一步：在共享包里登记

在 `packages/shared/src/common/realtime.ts` 的 `RT` 里加一个常量，在 `RealtimePayloads` 里加同名的载荷类型。注释写清楚谁发、发给谁、什么时候发：

```ts
export const RT = {
  // …
  /** an order of the recipient shipped (biz/order), after the shipping transaction commits */
  orderShipped: 'order:shipped',
} as const

export interface RealtimePayloads {
  // …
  'order:shipped': { id: number; no: string }
}
```

服务端读的是共享包**编译后**的产物：`pnpm dev` 会自动重新编译；没有运行 `pnpm dev` 时，执行 `pnpm --filter @qiwu/shared build`。前端直接读源码，不需要编译。

**命名规则：**

- 格式是 `<领域>:<事件>`，全小写，多个单词用 `-` 连接。领域是事件涉及的业务的简短名称，不一定和权限的领域相同。先看看 `RT` 里已有的前缀，不要冲突；
- 一个类型只表示一种含义、一种载荷结构。要改结构就新起一个类型，不要改旧的；
- 不要新增 Socket.IO 事件名，所有推送都走 `REALTIME_EVENT`。

### 第二步：服务端在事务提交后推送

```ts
@Injectable()
export class OrderService extends BaseCrudService<Order> {
  constructor(
    txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly realtime: RealtimeService,
  ) {
    super(txHost, Order)
  }

  async ship(id: number) {
    const order = await this.txHost.withTransaction(() => this.markShipped(id))
    // withTransaction 返回之后，事务已经提交
    this.realtime.toUser(order.ownerId, {
      type: RT.orderShipped,
      payload: { id: order.id, no: order.no },
    })
  }
}
```

### 第三步：前端订阅

见下文"[前端：订阅推送](#前端-订阅推送)"。载荷的类型同样来自 `RealtimePayloads`，不需要自己再写一遍。

## 使用规则

### 事务提交之后再推送

如果在事务里推送，对方收到提醒马上来读数据，可能读到还没提交、甚至已经回滚的数据。所以要在 `withTransaction(...)` **返回之后**再推送（[服务 · 提交之后才能做的事](/core/service#提交之后才能做的事)）。

::: warning 嵌套事务
`withTransaction` 可以嵌套，内层会加入外层的事务。如果你的方法可能在别人的事务里被调用，内层返回时事务**还没有提交**。

这种情况可以参考工作流的做法：在事务里只把"要推给谁"记在当前数据库连接上，等**最外层事务提交**时再统一推送。

```ts
// apps/server/src/modules/workflow/runtime/wf-notify.ts（节选）
@EventSubscriber()
@Injectable()
export class WfNotify implements EntitySubscriberInterface, OnModuleInit {
  // …
  afterTransactionCommit({ queryRunner }: TransactionCommitEvent): void {
    if (queryRunner.isTransactionActive) return       // 内层提交，外层还在进行
    const pushes = pushesOf(queryRunner)
    for (const [instanceId, users] of pushes)
      this.realtime.toUsers([...users], { type: RT.wfTask, payload: { instanceId } })
    pushes.clear()
  }
}
```

事务回滚时，这个数据库连接连同记下的内容一起被释放，什么也不会推送。
:::

### 推送只是提醒，不是数据通道

- 载荷里只放 id 和显示需要的最少字段。比如 `notify:bulletin` 只带公告的 id，不带正文；
- 对方需要详情时，通过普通接口读取，这样**权限和数据范围照常生效**；
- 推送不会再经过接收方的权限检查，所以只能把对方本来就能读到的内容推给他。

### 收件人由服务端决定

不要直接使用请求体里传来的用户 id，要在服务端按权限和数据范围算出收件人。示例页按用户或角色发送时，只取调用者数据范围内、启用的用户：

```ts
// apps/server/src/modules/demo/realtime/realtime.service.ts（节选）
private async recipients({ target, userIds, roleIds }: DemoRealtimeSendBody): Promise<number[]> {
  const qb = this.scopedQb('t').select('t.id', 'id').andWhere('t.enabled = 1')
  if (target === 'user') qb.andWhere('t.id IN (:...userIds)', { userIds })
  else
    qb.andWhere(
      `t.id IN (SELECT ur.user_id FROM iam_user_roles ur
                  JOIN iam_role r ON r.id = ur.role_id AND r.enabled = 1 AND r.deleted_at IS NULL
                 WHERE ur.role_id IN (:...roleIds) AND ur.deleted_at IS NULL)`,
      { roleIds },
    )
  return (await qb.getRawMany<{ id: number | string }>()).map((r) => Number(r.id))
}
```

`broadcast` 会发给**每一个**已登录的用户，包括没有相关权限的人，只用于人人都能看的内容。示例页的"全员"发送，除了 `demo.realtime.send` 还要求有 `demo.realtime.broadcast` 权限。

### 发出即结束，不保证送达

不在线的用户收不到，之后也不会补发；断线期间的推送也会丢失。所以：

- 必须送达的内容先存进数据库，推送只负责提醒"有新内容"。最常见的做法是直接发[站内信](/core/notify)：`notifier.send()` 在当前事务里写入站内信，等最外层事务提交后再投递，并自动推送 `notify:new`；事务回滚时什么都不会发；
- 前端每个依赖推送的界面，都要有"重新读取"的途径（见下文"[断线后的兜底](#断线后的兜底)"）。

### 载荷的格式和大小

- 只用 JSON 值：数字、字符串、布尔、数组、对象。时间用 ISO 8601 字符串，不要传 `Date`；
- 不放 HTML、令牌或其他机密信息；
- 尽量小。服务端没有给推出去的消息设大小上限，但推送只是提醒，几个 id 加一个标题就够了；
- 浏览器发给服务端的数据帧最大 16 KB（网关的 `maxHttpBufferSize: 16_384`）。网关没有任何接收处理函数，所以这个限制只是防止有人乱发大数据。

### 不要在网关里接收消息

网关 `apps/server/src/core/realtime/realtime.gateway.ts` 没有 `@SubscribeMessage` 处理函数。浏览器要提交数据，一律走普通的 HTTP 接口，这样权限（`@RequirePerm`）、参数校验、操作日志（`@ActionLog`）和限流都照常生效。示例页的"发送"就是一个普通接口：

```ts
// apps/server/src/modules/demo/realtime/realtime.controller.ts
@Post('send')
@HttpCode(200)
@RequirePerm(demoRealtimePerms.send)
@RateLimit(30, 60_000)
@Idempotent()
@ActionLog({ domain: 'demo.realtime', verb: 'send' })
@ApiOperation({
  summary:
    'Push plain text as `demo:message` to users, roles (enabled users in scope) or everyone (`demo.realtime.broadcast`)',
})
@ApiEnvelope(demoRealtimeSendVo)
send(@Body({ schema: demoRealtimeSendBody }) body: DemoRealtimeSendBody) {
  return this.demo.send(body)
}
```

演示模式（`APP_DEMO_MODE=true`）下，这个接口和其他写操作一样被拒绝，返回 403（`A0431`）。

## 前端：订阅推送

连接在 `main.ts` 里启动一次（`startRealtime()`）：出现访问令牌就连接，令牌更换就用新令牌重连，退出登录就断开。页面只需要订阅：

```ts
// apps/web/src/views/workflow/center/todo.vue（节选）
import { RT, type WfTaskItemVo } from '@qiwu/shared'
import { wfCenterApi } from '@/api/workflow/center'
import { onRealtime } from '@/core/realtime/socket'
import { useCenterList } from './use-center-list'

const { query, rows, total, loading, refresh, onSortChange, open } = useCenterList<WfTaskItemVo>({
  api: { page: wfCenterApi.todo },
  sort: '-createdAt,-id',
})
// 我的待办有变化：重新加载列表
onRealtime(RT.wfTask, () => void refresh())
```

`onRealtime(type, fn)` 的处理函数直接拿到这个类型的载荷，类型是 `RealtimePayloads[type]`。要用载荷时：

```ts
// apps/web/src/views/demo/realtime/index.vue（节选）
onRealtime(RT.demoMessage, (m) => {
  log.value = [{ ...m, key: ++seq }, ...log.value].slice(0, LOG_MAX)
})
```

注意：

- **自动取消订阅**：在组件的 `<script setup>`（或其他 effect scope）里调用时，组件卸载就自动取消。在组件外面调用（比如 store、模块顶层），要保存它返回的取消函数，不用时自己调用，否则处理函数会一直留着；
- **页面缓存**：开启了页面缓存（keep-alive）的页面，切换到别的标签页时只是"暂停"，订阅还在，关闭标签页才取消。示例页的接收日志就是这样在切换标签后保留的。暂停时不该处理的，用 `onActivated` / `onDeactivated` 自己控制；
- **处理函数要短、不要抛异常**：同一类型的处理函数是依次同步调用的，一个抛出异常，后面的就收不到了。需要重新加载时写 `void load()`，请求错误交给请求层提示；
- **按纯文本显示**：载荷可能包含用户输入的内容（示例页原样转发用户写的文字）。只用模板插值（双大括号，Vue 会自动转义）显示，绝不用 `v-html`，也不要拼进链接。需要富文本时只推 id，再通过接口读取已经清洗过的内容。

### 连接状态

| 导出 | 值 | 用途 |
| --- | --- | --- |
| `realtimeStatus` | `'up'`（已连接）、`'reconnecting'`（重连中）、`'down'`（已断开） | 在界面上显示，比如示例页的连接状态标签 |
| `realtimeUp` | 布尔值 | 判断要不要用轮询兜底 |

### 断线后的兜底

断线期间的推送会丢失，所以界面不能只靠推送保持正确。待办数是标准写法：收到推送、重新连上、窗口获得焦点时重新加载；连接断开期间，页面在前台时每 60 秒查询一次：

```ts
// apps/web/src/core/layout/todo-count.ts（节选）
const POLL_MS = 60_000

void load()
onRealtime(RT.wfTask, () => void load())                 // 收到推送
watch(realtimeUp, (up) => up && void load())             // 重新连上
useEventListener(window, 'focus', () => void load())     // 窗口获得焦点
const visibility = useDocumentVisibility()
useIntervalFn(() => {
  if (!realtimeUp.value && visibility.value === 'visible') void load()   // 断开期间轮询
}, POLL_MS)
```

右上角的通知铃铛 `apps/web/src/core/layout/NotifyBell.vue` 也是同样的写法。新增依赖推送的界面照着做即可。

## 断线与重连

| 情况 | 前端怎么做 | `realtimeStatus` |
| --- | --- | --- |
| 网络中断、电脑休眠、服务端重启 | Socket.IO 自动重连（间隔约 1 秒起，最长 5 秒）。每次重连都带上最新的访问令牌和语言 | `reconnecting`，连上后 `up` |
| 连接被拒绝 `unauthorized`（断线期间访问令牌过期了） | 刷新一次令牌，用新令牌重连；刷新失败就停止，下一次请求时由请求层弹出"会话已过期" | `reconnecting` → `up` 或 `down` |
| 连接被拒绝 `forbidden_origin`（来源网站不被允许） | 不重试 | `down` |
| 服务端主动断开（强制下线、会话结束、到了会话的最长期限） | 不重试。强制下线时先收到 `session:kicked`，提示"你已被管理员强制下线，请重新登录"，清除登录状态并跳到登录页 | `down` |
| 访问令牌更换（包括在另一个标签页登录了别的会话） | 关闭旧连接，用新令牌连接 | `reconnecting` → `up` |
| 退出登录 | 关闭连接 | `down` |

## 移动端（uni-app）

移动端（`mobile/`）也连同一个网关、用同一份推送类型（`@qiwu/shared` 的 `RT`、`REALTIME_EVENT`），规则和上面一样，只是写法不同。代码都在 `mobile/src/core/realtime.ts`。

### 一套代码跑三个平台

用的是官方的 `socket.io-client`（4.8.4），加一个自己写的传输类：继承 socket.io-client 导出的 `WebSocket` 传输，只重写 `createSocket`，改用 `uni.connectSocket`。这样 H5、微信小程序、App 走同一套代码：

```ts
// mobile/src/core/realtime.ts（节选）
export class UniSocketTransport extends WsTransport {
  override createSocket(url: string) {
    const ws: Record<string, ((e?: unknown) => void) | undefined> = {}
    // 带了回调，uni 才返回 SocketTask（而不是 Promise）；小程序"域名不在合法列表"这类早期失败
    // 也会变成 socket 错误，交给 Socket.IO 退避重连
    const task = uni.connectSocket({ url, fail: (e) => ws.onerror?.(e) })
    task.onOpen(() => ws.onopen?.())
    task.onMessage(({ data }) => ws.onmessage?.({ data }))
    task.onClose((e) => ws.onclose?.(e))
    task.onError((e) => ws.onerror?.(e))
    ws.send = (data) => task.send({ data: data as string | ArrayBuffer })
    ws.close = () => task.close({})
    return ws
  }
}
```

调用 `uni.connectSocket` 时一定要带 `fail` 回调，原因见注释。

连接地址：H5 连页面自己的地址，经开发服务器和 `vite preview` 的 `/socket.io` 代理转发（`mobile/vite.config.ts`，代理要写成对象形式 `{ target, ws: true }`，否则 `Host` 被改写，Origin 检查会判为外站）；小程序和 App 连 `VITE_API_BASE` 的地址（`https://…` 对应 `wss://…/socket.io/`）。

### 处理哪些推送

移动端只处理三种，其余的忽略：

```ts
// mobile/src/core/realtime.ts（节选）
function onMessage(msg: RealtimeMessage) {
  if (msg.type === RT.wfTask || msg.type === RT.notifyNew) useCountsStore().load()
  else if (msg.type === RT.sessionKicked) kicked()
}
```

- `wf:task`、`notify:new`：通过普通接口重新读取待办数、审批中数量和未读数（`mobile/src/core/stores/counts.ts`），页签角标和工作台跟着更新；
- `session:kicked`：断开连接、清除登录状态、回到登录页，提示"你已被管理员强制下线，请重新登录"；
- `notify:bulletin` 不处理："消息"页每次显示都会重新加载。

每次连上（包括重连）也会读一次计数，补上断线期间的变化。

### 什么时候连、什么时候断

| 时机 | 代码 | 动作 |
| --- | --- | --- |
| 应用回到前台（冷启动也算） | `mobile/src/App.vue` 的 `onShow(startRealtime)` | 连接 |
| 底部任一页签显示 | `mobile/src/core/components/QwTabBar.vue` 的 `onShow` | 连接，并读一次计数 |
| 应用进入后台 | `mobile/src/App.vue` 的 `onHide(stopRealtime)` | 断开 |
| 登录、退出登录 | `mobile/src/core/stores/auth.ts` | 断开，新用户不会沿用上一位的连接 |

`startRealtime()` 没有登录会话或者已经有连接时什么也不做，可以放心重复调用。每次握手都读取当前的访问令牌和语言。移动端的访问令牌只放在内存里，所以启动后第一次握手会被拒（`unauthorized`），这时刷新一次令牌再连；刷新后仍被拒，或者被拒为 `forbidden_origin`，就不再连，交给轮询。

### 轮询兜底

连不上时（小程序没配 socket 合法域名、网络受限、Origin 被拒等），页签显示期间每 60 秒调一次 `pollCounts()`。它只在没有连接时才真的发请求：

```ts
// mobile/src/core/realtime.ts（节选）
export function pollCounts() {
  if (!realtimeUp.value) useCountsStore().load()
}

// mobile/src/core/components/QwTabBar.vue（节选）
onShow(() => {
  // …
  counts.load()
  startRealtime()
  stop()
  timer = setInterval(pollCounts, POLL_MS)   // POLL_MS = 60_000
})
```

所以 socket 连不上时，角标最迟 60 秒内更新。H5 上的自动测试断言推送后 2 秒内更新；真机上不保证这个速度。

### 小程序不能用 `Function`

engine.io-client 在加载时会求值 `Function("return this")()`，而微信小程序禁止 `Function` 和 `eval`。`mobile/vite.config.ts` 里的预处理插件把它的 `globals` 模块换成 `mobile/src/core/eio-globals.ts`；`mobile/scripts/mp-size.mjs` 在 `build:mp-weixin` 之后检查产物，出现 `Function("return this")`、`require("ws")` 或 `xmlhttprequest-ssl` 就失败。同一个配置里，`socket.io-client` 被别名到它的真实目录，因为 uni 强制 `preserveSymlinks`，从 pnpm 的符号链接位置找不到它自己的依赖。

### 测试

- 单元测试 `mobile/src/__tests__/mobile-realtime.spec.ts`：真实的 socket.io-client 跑在伪造的 SocketTask 上，用例一帧一帧扮演服务端；
- Playwright `mobile/e2e/mobile-push.spec.ts`：H5 经预览代理连真实服务端，断言新待办和站内信 2 秒内刷新角标、强退 2 秒内回到登录页、切到后台断开、回到前台 2 秒内重连；
- `mobile/e2e/mobile-home.spec.ts` 的轮询用例先用 `page.routeWebSocket` 挡掉 socket，专门测兜底。

## 连接时的验证

每次连接（包括每次重连），网关都会检查：

1. **来源网站**：浏览器发起的连接，`Origin` 头必须是本站自己（`协议://Host`），或者是环境变量 `CORS_ORIGIN` 里列出的地址，否则拒绝，错误是 `forbidden_origin`。这是为了防止别的网站借用户的登录状态偷偷建立连接（跨站 WebSocket 劫持）。没有 `Origin` 头的非浏览器客户端不检查这一项，但同样要有有效的令牌；
2. **访问令牌**：握手参数 `auth.token` 必须属于一个有效的第一方登录会话，也就是电脑端（`console`）或移动端（`mobile`）的登录（和接口鉴权用的是同一套令牌服务），否则拒绝，错误是 `unauthorized`。[OAuth2 客户端](/features/oauth)的令牌连不上。判断用的是 `apps/server/src/core/auth/token.service.ts` 里的 `isFirstParty()`，名单是共享包的 `FIRST_PARTY_CLIENTS`。

通过之后：

- 连接加入 `user:{id}`、`sid:{sid}`、`type:{userType}` 三个房间；
- 最迟在会话的**绝对过期时间**断开（默认 12 小时，"保持登录"时 7 天）；
- 退出登录、强制下线、修改或重置密码、停用或删除用户时，`SessionRevoker` 结束会话，同时断开这些会话的连接，连在其他实例上的也一样。强制下线时会先推送 `session:kicked`；
- 断开的通知是经 Redis 发给其他实例的，可能丢失。所以每个实例每 60 秒检查一遍自己的连接，会话已经不存在的就断开（`realtime.gateway.ts`）。

## 测试

服务端 e2e 测试可以用 `apps/server/test/setup/socket.ts` 里的助手，像浏览器一样连上来，收集收到的推送。应用要用 `app.listen(0, '127.0.0.1')` 真正监听一个端口：

```ts
// apps/server/test/e2e/demo-realtime.e2e-spec.ts（节选）
import { closeSockets, connect, inbox, socketOf } from '../setup/socket.js'

// 登录后连上，inbox() 返回一个数组，之后收到的信封都会放进去
token[name] = (await signIn(app, PREFIX + name)).accessToken
got[name] = inbox(await connect(socketOf(app, { token: token[name] })))

/** 等正在发送的消息到达（同一进程，本机回环） */
const settle = () => new Promise((r) => setTimeout(r, 150))

afterAll(async () => {
  closeSockets()           // 关闭这个测试打开的所有连接
  // …
})
```

- `socketOf(app, auth, origin?)` 创建一个还没连接的客户端，可以带上 `Origin` 头模拟浏览器；它不会自动重连，每次连接都由测试自己控制；
- `connect(socket)` 连上后返回；被拒绝时抛出 `connect_error`，可以断言错误是 `unauthorized` 还是 `forbidden_origin`；
- `disconnected(socket)` 等待下一次断开，返回断开原因。

前端单元测试里，模拟（mock）`@/core/realtime/socket` 模块，把处理函数存起来，测试里直接调用它来模拟"收到推送"。写法见 `apps/web/src/__tests__/demo-realtime.spec.ts`。

## 部署

### 开发环境

Vite 开发服务器已经把 `/socket.io` 按 WebSocket 方式转发到后端：

```ts
// apps/web/vite.config.ts（节选）
const proxy = {
  '/api': { target: api },
  '/files': { target: api },
  '/socket.io': { target: api, ws: true },
}
```

`CORS_ORIGIN` 是逗号分隔的地址列表，列出除本站以外还允许连接的网站。`.env.example` 里默认是开发时前端的地址 `http://localhost:5173`。前端单独部署在另一个域名时，要把那个地址加进去。

### 反向代理

生产环境由 nginx 转发 `/socket.io/`。要点：

- 设置 `Upgrade` 和 `Connection` 头，把普通 HTTP 请求"升级"为 WebSocket；
- 保留浏览器访问的原样地址：`Host`，以及 `X-Forwarded-Host`（`TRUST_PROXY` 信任这个代理时，服务端以它为准），用来和 `Origin` 比较；
- nginx 负责 HTTPS 时，要传 `X-Forwarded-Proto`。否则服务端以为本站是 `http://…`，和浏览器的 `Origin`（`https://…`）对不上，连接会被 `forbidden_origin` 拒绝。服务端只相信 `TRUST_PROXY` 里登记的代理传来的这个头（默认 `loopback`，也就是本机的 nginx）；
- WebSocket 连接的读超时要比心跳间隔长，下面用 75 秒。

```nginx
location ^~ /socket.io/ {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $http_host;
  proxy_set_header X-Forwarded-Host $http_host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_read_timeout 75s;
}
```

::: tip 非标准端口
示例里的 `Host` 和 `X-Forwarded-Host` 都用 `$http_host`，也就是浏览器访问的原样地址，带端口号。如果把它们改成 `$host`（不带端口），而网站对外用的又不是 80 或 443 端口（比如 `https://admin.example.com:8443`），浏览器的 `Origin` 带端口，和服务端算出的本站地址对不上，连接会被拒绝；这时要把这个地址写进 `CORS_ORIGIN`。
:::

完整的 nginx 配置见[部署](/guide/deploy)。

只用 WebSocket 传输，不用 HTTP 长轮询，所以负载均衡**不需要会话粘滞**（同一个用户的请求固定发到同一台服务器）。如果以后打开长轮询，就必须配置会话粘滞。

### 多实例

同一个后端程序可以运行多份（多个实例），连接分散在不同实例上。服务端已经内置了 Socket.IO 的 Redis **分片适配器**（`@socket.io/redis-adapter` 的 `createShardedAdapter`，`subscriptionMode: 'dynamic'`），在 `apps/server/src/app.setup.ts` 的 `setupApp` 里挂载，正式运行和测试走同一个入口，业务代码不用改：

- `toUser` / `toUsers` / `toUserType` / `broadcast` 能送到连在任何实例上的连接。用户、会话、用户类型的房间各有自己的频道，消息只发给有这些连接的实例；
- `onlineUsers` 通过 `fetchSockets()` 统计所有实例上的不同用户；
- `SessionRevoker` 结束会话时，断开所有实例上这个会话的连接（`disconnectSockets()`）；如果是强制下线，会先推送 `session:kicked`；
- 每个实例除了业务用的 Redis 连接，再给适配器开两条（发布、订阅）。启动时要等订阅真正完成，订阅失败就拒绝启动；新连接加入房间后，也要等这些房间的订阅就绪；关闭时一并清理。

**部署前提：**

- Redis **7 或更高**：分片适配器用的是 `SSUBSCRIBE`、`SPUBLISH`、`PUBSUB SHARDNUMSUB` 命令。项目的 Redis 账号能访问 `qw:*` 的键和频道（`~qw:*`、`&qw:*`）就够了，不需要额外的频道规则；它还要能执行限流用的 Lua 脚本（`EVAL`、`TIME` 等普通命令）；
- 同一个部署的所有实例连同一个 MySQL 数据库、同一个 Redis、同一个 `REDIS_DB` 和 `REDIS_KEY_PREFIX`，并使用相同的 `APP_SECRET`、登录配置、种子数据和程序版本；
- 发布/订阅的频道不按 Redis 的库号隔离，所以频道名里带上了库号：适配器用 `qw:socket.io:<REDIS_DB>`，定时任务的同步通知用 `qw:job:sync:<REDIS_DB>`（都由 `cache-namespaces.ts` 的 `redisChannel` 生成）。**不同的部署要用不同的库号**，否则一个环境的推送会发给另一个环境里 id 相同的用户；
- 反向代理把 `/socket.io/` 转发到每一个实例（见上文"[反向代理](#反向代理)"），`TRUST_PROXY` 只登记真正的代理；
- 用本地磁盘存储时，所有实例要挂同一个共享存储卷（路径相同）；跨多台机器建议用 S3 兼容存储，见[文件管理 · 本地磁盘](/features/storage#本地磁盘)。

**送达边界：** 分片适配器不支持 Socket.IO 的"连接状态恢复"，也不保存消息。Redis 或网络出故障、实例重启时，推送可能丢失，重连后不会补发。所以照样按"[发出即结束，不保证送达](#发出即结束-不保证送达)"来写：可靠的数据先存进数据库，前端在重连后重新读取，并保留轮询兜底。

**其他共享状态：**

- 限流计数存在 Redis 里，所有实例共用一份额度；Redis 出错时请求直接失败，不会放行，见[防重复提交、限流与锁](/core/guards)；
- 定时任务在所有实例上同一个执行时间只执行一次，见[定时任务 · 部署多个实例时](/features/job#部署多个实例时)；
- 限流和分布式锁都按单个 Redis 节点设计，不保证能用于 Redis Cluster；Redis 故障切换时锁可能失效，不能代替业务上的防重；
- 邮件的发送连接每个实例各自缓存，改了邮件账号后，每个实例在下一次发邮件前重新建立。

::: info 验证范围
模板自带的测试 `apps/server/test/e2e/core-multi-instance.e2e-spec.ts` 在同一台机器上启动两个服务进程，用真实的登录、推送、强制下线和限流（累计第 31 次发送返回 429）验证跨实例行为，还包括一个进程重启后推送照常送达。多台机器、负载均衡、共享存储、S3、Redis 故障切换和生产容量，要在你自己的部署环境里验收。
:::
