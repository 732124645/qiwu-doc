---
title: 定时任务开发
description: '用 @JobHandler 写定时任务处理器：zod 参数规则、signal 和 log、用种子预置任务、支持的 Cron 写法，并发、错过策略、超时和重试配置，以及内置处理器。'
---

# 定时任务

::: tip 后台怎么用
这一页讲写代码。后台页面能做什么、各项设置的含义，见[定时任务](/features/job)。
:::

需要"每天凌晨清理一次"、"每 5 分钟检查一次超时"这类定时执行的逻辑时，写一个**任务处理器**，再在后台 **系统监控 → 定时任务** 里配置执行时间。

## 写一个处理器

在任意一个服务的方法上加 `@JobHandler(名称, 参数规则)`。下面是项目内置的示例处理器 `demo.echo`：

```ts
// modules/platform/scheduler/builtin-jobs.ts
import { setTimeout as sleep } from 'node:timers/promises'
import { z } from 'zod'
import { JobHandler, type JobContext } from '../../../core/scheduler/job-handler.js'

const echoParams = z.object({
  message: z.string().max(200).default('hello'),
  delayMs: z.number().int().min(0).max(600_000).default(0),
})

/** 延迟 delayMs 毫秒后返回 message，用来试用定时任务页面 */
@JobHandler('demo.echo', echoParams)
async echo({ message, delayMs }: z.output<typeof echoParams>, { signal }: JobContext) {
  if (delayMs) await sleep(delayMs, undefined, { signal })
  return message
}
```

- **名称**：小写字母，用点分隔，至少两段，比如 `biz.order.close-expired`。名称重复时应用会启动失败；
- **参数规则**：一个 zod 规则。每次执行前，后台配置的参数（JSON）都要先通过它的校验。规则里的默认值，会作为在页面上新建任务时的默认参数。不需要参数时可以省略；
- **返回值**：会显示在执行日志的"输出"里。返回字符串就原样显示，返回其他值会转成 JSON；
- 这个服务必须是某个模块 `providers` 里的 `@Injectable()`。**不需要额外注册**，应用启动时会自动扫描所有带 `@JobHandler` 的方法。

不需要参数的处理器可以写得很短：

```ts
@JobHandler('session.sweep')
async sweep() {
  return `removed ${await sweepOnline(this.redis)}`
}
```

## 第二个参数 ctx

`ctx` 只有两个成员：

| 成员 | 作用 |
| --- | --- |
| `signal` | `AbortSignal`。任务超时、应用关闭或者丢失任务锁时会被触发。**耗时较长的处理器要检查它**：在循环里判断 `signal.aborted`，或者把它传给 `fetch` 和定时器 |
| `log(line)` | 往本次执行日志的"输出"里追加一行文字 |

一个处理大量数据的处理器，大致是这样：

```ts
@JobHandler('biz.order.close-expired')
async closeExpired(_params: unknown, { signal, log }: JobContext) {
  let total = 0
  while (!signal.aborted) {
    const closed = await this.orders.closeExpiredBatch(500)   // 每次处理 500 条
    total += closed
    if (closed < 500) break
  }
  log(`closed ${total}`)
  return total
}
```

::: warning 任务里没有"当前用户"
定时任务不是由某个用户发起的，所以 `clsGet('principal')` 是 `undefined`。这时 `scopedQb()` 会加上 `1=0`，带数据范围的实体**什么都查不到**；要读全部数据，在方法上加 `@SkipDataScope()`（见[数据范围怎么算](/core/permission#数据范围怎么算)）。任务里要写的数据，其 `created_by` 为空。
:::

## 用种子创建任务

处理器只是"能做什么"，还需要一条 `job_task` 记录来决定"什么时候做"。可以让管理员在页面上新建，也可以在种子里预置：

```ts
// db/seeds/scheduler/scheduler.seed.ts（节选）
{
  name: 'seed.task.demoEcho',          // 任务名称，是一个翻译键
  handler: 'demo.echo',
  onInsert: {
    cron: '0 0 * * * *',               // 每小时整点
    misfire: 'skip',
    timeout_ms: 60_000,
    enabled: 0,                        // 默认不启用
    group_code: 'default',
    params: { message: 'hello' },
  },
}
```

种子只在**第一次插入**时写入这些值。之后管理员在页面上修改的执行时间、启用状态都不会被重新执行种子覆盖。

## Cron 表达式

支持 5 段（从分钟开始）或 6 段（从秒开始）：

```text
秒 分 时 日 月 周
0  0  2  *  *  *       每天 02:00:00
0  */5 * *  *  *       每 5 分钟
0  30 9  *  *  1-5     工作日 09:30
```

只支持数字和 `* , - /`，不支持 `?`、`L`、`W`、`#` 和 `@daily` 这类写法。后台页面有可视化的 Cron 编辑器，并且会显示接下来 5 次的执行时间。

## 任务的配置项

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| 允许并发 `allow_overlap` | 否 | 否：上一次还没执行完时，这一次跳过（记为 `skipped`） |
| 错过策略 `misfire` | `skip` | 服务停机期间错过的执行：`skip` 跳过，`run_once` 启动后补执行一次 |
| 超时 `timeout_ms` | 60 秒 | 超时后触发 `signal`，本次记为 `timeout`；0 表示不限时 |
| 重试次数 `retry_max` | 0 | 失败或超时后重试的次数，最多 10 次 |
| 重试间隔 `retry_delay_ms` | 1 秒 | |

每次执行（包括每次重试）都会在执行日志里留下一条记录。同一个执行时刻只会执行一次。

## 内置的处理器

| 名称 | 作用 |
| --- | --- |
| `audit.purge` | 按保留天数清理日志和过期数据 |
| `notify.dispatch` | 补发失败或未发出的消息 |
| `session.sweep` | 清理过期的在线会话记录 |
| `wf.task.remind` | 审批超时提醒 |
| `demo.echo` | 示例 |
