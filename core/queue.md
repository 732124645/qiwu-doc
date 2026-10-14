---
title: 任务队列开发
description: '用任务队列把耗时工作交给后台执行：registerQueue 声明队列、TenantJobProcessor 写处理器、事务提交后用 QueueService.add 添加任务，以及默认重试、租户规则和 Redis 要求。'
---

# 任务队列

::: tip 后台怎么用
这一页讲写代码。队列监控页能看什么、能做什么，见[队列监控](/features/monitor#队列监控)。
:::

**任务队列**用来把不必在请求里做完的工作交给后台执行，比如耗时的导出和计算、消息的批量发送、失败后的重试。接口先返回，任务排队，由后台的**处理器**（worker）取出来执行。

队列基于 BullMQ，直接使用应用已有的 Redis，不需要另外部署消息服务。

## 队列还是定时任务

| 场景 | 用什么 |
| --- | --- |
| 某个操作触发了一件耗时的事，做完就结束 | 任务队列 |
| 按固定时间重复执行，比如每天凌晨清理 | [定时任务](/core/job) |

通知发件箱和定时任务不走队列，保持原样。

::: warning 处理器必须可以重复执行
任务**至少执行一次**：失败会重试，进程崩溃时执行中的任务会被其他实例重新取走。所以同一个任务执行两次，结果也要正确（这叫**幂等**）。
:::

## 写一个队列

下面以“生成报表”为例，分三步。

**第一步：在模块里声明队列。** 队列名用小写短横线，全应用唯一，例如 `biz-report`：

```ts
// modules/biz/report/report.module.ts
import { registerQueue } from '../../../core/queue/queue-registry.js'

@Module({
  imports: [registerQueue({ name: 'biz-report' })],
  providers: [ReportService, ReportProcessor],
})
export class ReportModule {}
```

**第二步：写处理器。** 继承 `TenantJobProcessor`，用 `@Processor('<队列名>')` 标记，只实现 `handle`：

```ts
// modules/biz/report/report.processor.ts
import { Processor } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { type QueuedJob, TenantJobProcessor } from '../../../core/queue/tenant-job.processor.js'

export interface ReportJob {
  reportId: number
}

@Processor('biz-report')
export class ReportProcessor extends TenantJobProcessor<ReportJob> {
  constructor(private readonly reports: ReportService) {
    super()
  }

  // 已经在添加任务时的租户里执行，ORM 会自动带上租户条件
  protected async handle({ reportId }: ReportJob, job: Job<QueuedJob<ReportJob>>) {
    await this.reports.build(reportId)
    return { attempt: job.attemptsMade + 1 }
  }
}
```

**第三步：在服务里添加任务。** 注入 `QueueService`，调用 `add(队列名, 任务名, 任务数据, 选项)`。如果先在事务里改了数据，要**等事务提交之后再添加**，否则任务可能在提交前就被取走，读不到新数据（做法同[提交之后才能做的事](/core/service#提交之后才能做的事)）：

```ts
constructor(
  private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  private readonly queues: QueueService,
) {}

async requestBuild(reportId: number) {
  await this.txHost.withTransaction(async () => {
    // …把报表状态改成“生成中”…
  })
  // 事务已提交，再添加任务；同一租户里同一 jobId 的任务还在队列里（含保留的已完成、已失败任务）时不会重复添加
  await this.queues.add('biz-report', 'build', { reportId }, { jobId: `report-${reportId}` })
}
```

任务数据只放 id 等少量字段，处理时再从数据库读取。不要放密码、令牌等秘密。

## 重试和租户

- **重试**：默认最多执行 3 次，第二次在 5 秒后，第三次再过 10 秒；保留最近 1000 个完成任务和 5000 个失败任务。确定不该再试时，抛出 BullMQ 的 `UnrecoverableError`，任务立即失败。`add` 的第四个参数可以覆盖 `attempts`、`backoff`、`delay`、`priority`、`jobId` 等。
- **租户**：`add` 自动记下当前租户，处理器在同一个租户里执行；上下文没有租户（或在 `allTenants` 里）时会抛出 `TenantContextMissing`，任务不会入队。租户队列里自定义的 `jobId` 会存为 `t<租户 id>-<你给的 id>`，两个租户用同一个 id 互不影响。只处理平台表的队列可以声明为平台级：`registerQueue({ name: 'platform-sync', platform: true })`。租户代码的通用规则见[编写租户感知的代码](/core/tenancy)。

## 部署时注意

- 每个实例都会运行全部处理器，同一个任务只会被一个实例取走，加实例就加并发。
- Redis 的 `maxmemory-policy` 必须是 `noeviction`，应用的 Redis 用户需要只读的 `INFO`。详见仓库文档的 Redis 要求。

## 更多

仓库的[任务队列文档](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/queue.md)是完整参考：

- [组成](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/queue.md#组成)：各部分的位置和连接方式；
- [添加队列与处理器](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/queue.md#添加队列与处理器)：完整示例和自定义 id 的规则；
- [租户规则](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/queue.md#租户规则)、[重试与保留](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/queue.md#重试与保留)；
- [每个实例都运行处理器](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/queue.md#每个实例都运行处理器)：并发和优雅关闭；
- [队列监控页](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/queue.md#队列监控页)、[Redis 要求](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/queue.md#redis-要求)；
- [设计说明 · 任务队列](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/design-notes.md#queue)：为什么这样设计。
