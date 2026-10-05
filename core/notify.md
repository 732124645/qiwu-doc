# 消息通知

::: tip 后台怎么用
这一页讲写代码。后台页面能做什么、各项设置的含义，见[消息中心](/features/messaging)。
:::

给用户发站内信、邮件或短信，统一调用一个方法：`notifier.send()`。你只需要说"用哪个模板、发给谁、参数是什么"，**发哪些渠道、用什么语言、按什么时区显示时间**，都由通知中心决定。

## 发送

`Notifier` 是全局提供的，直接注入即可。项目里工作流的超时提醒是这样发的：

```ts
// modules/workflow/runtime/wf-notify.ts
await this.notifier.send({
  template: 'wf.task.overdue',
  to: [task.assigneeId],                            // 用户 id 数组
  params: {
    ...(await this.params(inst)),
    node: { i18n: task.nodeName },                  // 翻译键：按收件人的语言翻译
    dueAt: { datetime: task.dueAt!.toISOString() }, // 时间：按收件人的时区显示
  },
})
```

### 参数说明

```ts
interface NotifySend {
  template: string                  // 模板编码，比如 'biz.order.shipped'
  to: NotifyTo[]                    // 收件人
  params?: Record<string, NotifyParam>
  channels?: ('inbox' | 'mail' | 'sms')[]   // 不填：凡是这个编码有启用模板的渠道都发
}
```

**收件人**可以是：

| 写法 | 说明 |
| --- | --- |
| `42` | 用户 id。按这个用户的语言和时区渲染；用户不存在或已删除时直接跳过 |
| `{ email: 'a@b.com' }` | 不是系统用户的邮箱。按当前请求的语言渲染 |
| `{ mobile: '13800000000' }` | 不是系统用户的手机号 |

**参数值**可以是：

| 写法 | 渲染结果 |
| --- | --- |
| `'张三'`、`42`、`true` | 原样 |
| `{ i18n: 'seed.wf.leave' }` | 按收件人的语言翻译。找不到这个键时原样输出，所以管理员自己填写的名称也能用 |
| `{ dict: 'crm.customer_level', value: 'vip' }` | 字典标签，按收件人的语言显示 |
| `{ datetime: iso字符串 }` | 按收件人的时区显示为 `YYYY-MM-DD HH:mm` |

只发站内信的写法：

```ts
await this.notifier.send({
  template: 'scheduler.job.timeout',
  to: roots.map(({ id }) => Number(id)),
  channels: ['inbox'],
  params: { task: { i18n: task.name }, handler: task.handler, attempt },
})
```

## 模板

模板存在数据库里，每个渠道一张表，**同一个编码按语言各存一行**。管理员可以在 **系统管理 → 消息中心** 的各个模板页面里修改内容。

模板中用 `{参数名}` 作为占位符：

```text
待审批：{initiator}的{model}
{initiator} 于 {startedAt} 发起的{model}（编号 {instanceId}）已到「{node}」，等待您审批。
```

### 用种子预置模板

```ts
// db/seeds/workflow/templates.seed.ts（节选）
import { upsertTemplates } from '../messaging/templates.js'

await upsertTemplates(
  q,
  'msg_inbox_template',            // 站内信模板表；邮件是 msg_mail_template，短信是 msg_sms_template
  'wf.task.assigned',              // 模板编码
  {
    'zh-CN': {
      title: '待审批：{initiator}的{model}',
      body: '{initiator} 于 {startedAt} 发起的{model}（编号 {instanceId}）已到「{node}」，等待您审批。',
    },
    'en-US': {
      title: 'Approval needed: {model} from {initiator}',
      body: '{model} #{instanceId}, started by {initiator} at {startedAt}, is waiting for your approval at "{node}".',
    },
  },
  {
    category: 'business',
    sender_label: null,
    enabled: 1,
    name: 'seed.wfTemplate.taskAssigned',          // 模板名称（翻译键）
    param_names: ['model', 'initiator', 'instanceId', 'startedAt', 'node'],
  },
)
```

- 站内信模板有 `title` 和 `body`，邮件模板有 `subject` 和 `body`（HTML），短信模板只有 `body`；
- 种子只在第一次插入时写入内容。管理员之后修改过的模板，重新执行种子也不会被覆盖。

::: tip 中文写在种子里是允许的
"代码里不能有中文"这条规则不包括种子和翻译文件。模板本来就是给不同语言的用户看的内容。
:::

## 什么时候真正发出去

`send()` 并不会立即发送，而是先在**当前事务**里给每个渠道、每个收件人写一条"待发送"记录。**等最外层的事务提交之后**，才真正发出去。

这样有两个好处：

- 事务回滚了（比如审批操作失败了），通知记录也一起回滚，**不会发出错误的通知**；
- 服务在发送途中崩溃了，记录还在数据库里，定时任务 `notify.dispatch` 每分钟会补发，**不会丢消息**。每条消息最多尝试 3 次。

::: warning
只有通过 `txHost.withTransaction` 或 `@Transactional()` 开启的事务才会延迟发送。直接使用 `dataSource.transaction()` 的话，消息会被立刻发出。
:::

站内信写入后，会自动通过 WebSocket 通知收件人，页面右上角的铃铛会立即更新。

## 其他细节

- 收件人没有邮箱或手机号时，对应渠道的记录会被标记为"跳过"，并注明原因，不会报错；
- 发送失败只会记录下来，**不会让你的业务操作失败**；
- 所有发送记录都可以在 **系统管理 → 消息中心** 里查看。
