# 操作日志

::: tip 后台怎么用
这一页讲写代码。后台页面能做什么、各项设置的含义，见[监控与日志](/features/monitor)。
:::

操作日志记录"**谁、在什么时候、做了什么、结果如何**"，在 **系统管理 → 日志管理 → 操作日志** 中查看。

## 用法

在控制器方法上加 `@ActionLog`：

```ts
import { ActionLog, SkipActionLog } from '../../../../core/audit/action-log.js'

@Post()
@RequirePerm(bookPerms.create)
@Idempotent()
@ActionLog({
  domain: 'demo.book',
  verb: 'create',
  bizId: (_req, row) => (row as Book | undefined)?.id,   // 新增时，id 从返回值中取
})
create(@Body({ schema: bookCreate }) dto: BookCreate) { … }

@Put(':id')
@RequirePerm(bookPerms.modify)
@ActionLog({ domain: 'demo.book', verb: 'modify' })      // bizId 默认取 URL 里的 :id
update(…) { … }
```

| 选项 | 说明 |
| --- | --- |
| `domain` | 模块，和权限点的前两段相同，比如 `demo.book` |
| `verb` | 动作：`create`、`modify`、`remove`、`import`、`export`，或者模块自己的动作（kebab-case） |
| `bizId` | 业务 id。默认取 `req.params.id`；新增时要从返回值中取 |

## 必须加

**每个非 GET 的接口，都必须有 `@ActionLog` 或者 `@SkipActionLog()`。** 缺少的话，`pnpm verify` 的检查会失败。

确实不需要记录的操作，显式跳过，并在旁边写注释说明原因：

```ts
// a UI preference, not an auditable business change
@SkipActionLog()
```

导出虽然是 GET 请求，但涉及数据外流，也建议加上操作日志。

## 记录了什么

| 内容 | 说明 |
| --- | --- |
| 操作人、部门 | 当前登录用户 |
| 模块、动作、业务 id | 来自装饰器 |
| 请求方法、地址 | |
| IP、归属地、浏览器 | |
| 请求参数 | 查询参数和请求体，最多 4 KB |
| 返回结果 | 最多 2 KB |
| 成功或失败、错误原因、耗时 | |
| traceId | 可以和服务端日志对应起来 |

- 登录失败（401）和没有权限（403）的请求不会进入操作日志，因为它们在守卫阶段就被拦下了；参数校验失败的请求会记录；
- 日志是异步写入的，写入失败不会影响业务操作。

## 敏感字段自动脱敏

字段名包含 `pass`、`secret`、`token`、`key`、`otp`、`captcha` 等的字段，值会被自动替换成 `***`。

字段名看不出是敏感信息时，用 `@Sensitive` 声明：

```ts
import { Sensitive } from '../../../../core/redact.js'

@Sensitive('mobileCode')              // 可以加在方法上，也可以加在整个控制器上
```

声明之后，这个字段在操作日志、API 访问日志和错误日志中都会被隐藏。

## API 访问日志

除了操作日志，还有一个更底层的 **API 访问日志**（**系统管理 → 日志管理 → API 访问日志**），记录每一个请求。它由参数控制：

| 参数 | 说明 |
| --- | --- |
| `audit.http_trace.mode` | `off` 关闭、`write` 只记录非 GET 请求（默认）、`all` 记录全部请求 |
| `audit.http_trace.exclude_paths` | 不记录的路径，比如 `GET /api/monitor` |

不想被记录的接口（比如健康检查、频繁轮询的接口），在方法或控制器上加 `@SkipHttpTrace()`。

## 保留时间

日志默认保留 **180 天**，由定时任务 `audit.purge` 清理。API 错误日志只清理已处理和已忽略的，待处理的一直保留。保留天数可以在参数 `audit.retention_days` 中修改。
