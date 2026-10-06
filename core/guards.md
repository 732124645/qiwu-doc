---
description: '@Idempotent 防重复提交、@RateLimit 按 IP 限流和 RedisLock 分布式锁：各自的判断依据、何时返回 429、锁的自动续期，以及该用哪一个。'
---

# 防重复提交、限流与锁

三个工具解决三类不同的问题：

| 问题 | 工具 | 作用范围 |
| --- | --- | --- |
| 用户手快，连点两次"提交" | `@Idempotent()` | 同一个会话、同样的请求 |
| 有人疯狂调用某个接口（比如发短信、登录） | `@RateLimit()` | 同一个 IP |
| 某段逻辑同一时间只能有一个在执行 | `RedisLock` | 全局 |

## @Idempotent：防重复提交

```ts
@Post()
@RequirePerm(customerPerms.create)
@Idempotent()                       // 默认 3 秒
create(@Body({ schema: customerCreate }) dto: CustomerCreate) {
  return this.customers.create(dto)
}
```

- **判断依据**：同一个会话、同样的请求方法和地址、同样的请求体（上传接口还包括文件内容）；
- 3 秒内的重复请求返回 **429**；
- 如果第一次请求**失败了**，会立即解除限制，用户可以马上重试；
- 可以修改时长：`@Idempotent({ ttl: 10_000 })`。

项目规定：**新增类的接口都要加 `@Idempotent()`**（生成器已经加好了）。前端的提交按钮也要在请求期间显示 loading 并禁用，两边一起防护。

::: tip 上传接口
上传接口要把 `@Idempotent()` 写在上传装饰器的**上面**，这样文件内容也会参与判断。
:::

## @RateLimit：限流

```ts
@RateLimit(20, 60_000)              // 每个 IP 每分钟最多 20 次
```

两个参数分别是：次数、时间窗口（毫秒）。超过限制返回 **429**。

项目里真实的例子（实时推送示例的发送接口），几个装饰器组合使用：

```ts
@Post('send')
@HttpCode(200)
@RequirePerm(demoRealtimePerms.send)
@RateLimit(30, 60_000)
@Idempotent()
@ActionLog({ domain: 'demo.realtime', verb: 'send' })
```

注意：

- **按 IP 计数**，不是按用户。所以部署时 `TRUST_PROXY` 要配置正确，否则所有请求看起来都来自反向代理的 IP；
- 每个接口单独计数，计数存在 **Redis** 里（`qw:throttle:` 开头的键），部署多个实例时所有实例共用一份额度；
- 窗口是滚动的：每次请求在一个时间窗口后单独过期，计时用 Redis 服务器的时间，各台机器的时钟不一致也没有影响；
- Redis 出错或 5 秒内没有响应时，请求直接失败，返回 **500**，不会退回到进程内计数，也不会放行。

## RedisLock：分布式锁

```ts
import { RedisLock } from '../../../../core/guard/redis-lock.js'
import { redisKey } from '../../../../core/redis/cache-namespaces.js'

const lease = await this.locks.acquire(redisKey('lock', 'biz-report', reportId), 30_000)
if (!lease) return                             // 别人正在执行，这次跳过
try {
  await this.buildReport(reportId, lease.lost) // lease.lost 是一个 AbortSignal
} finally {
  await lease.release()
}
```

- `acquire(键, 有效期毫秒)`：只尝试一次，拿不到锁时返回 `null`；
- 拿到锁之后会**自动续期**（每隔三分之一的有效期续一次），直到调用 `release()`；
- 如果续期失败（比如 Redis 暂时连不上），`lease.lost` 会被触发。这时锁可能已经被别人拿走了，**正在做的事情要马上停下来**；
- `RedisLock` 不是全局提供的，要使用它，得把它加到你的模块的 `providers` 里。

::: tip 大多数时候你不需要它
- 防止同一条数据被同时修改：用数据库事务里的 `lockScopedIds`（行锁），见[数据库基础](/backend/database)；
- 防止定时任务重复执行：任务配置里的"允许并发"已经处理好了。

只有"跨多条数据、并且跨请求的互斥"才需要 Redis 锁。另外它只支持单节点 Redis，Redis 主从切换时，有极小的概率同时被两方拿到锁。
:::
