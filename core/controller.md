# 控制器

控制器负责**定义接口**：哪个地址、哪个 HTTP 方法、需要什么权限、接收什么参数、交给哪个服务处理。控制器本身应该很"薄"，业务逻辑都放在[服务](/core/service)里。

## 路由

```ts
@ApiTags('demo')
@Controller('demo/books')              // 路径前缀
export class BookController {
  @Get(':id')                          // GET /api/demo/books/:id
  get(@Param('id', ParseIntPipe) id: number) { … }
}
```

- 全局前缀是 `/api`，项目没有使用接口版本号；
- 完整地址 = `/api` + `@Controller` 的路径 + 方法上的路径；
- 路径的写法：`/api/<领域>/<资源的复数，短横线连接>`，比如 `/api/iam/users`、`/api/settings/dict-entries`。

| 装饰器 | HTTP 方法 | 用途 |
| --- | --- | --- |
| `@Get()` | GET | 查询 |
| `@Post()` | POST | 新增，或者不属于增删改的动作 |
| `@Put()` | PUT | 修改 |
| `@Delete()` | DELETE | 删除 |

::: warning 固定路径写在 `:id` 前面
`GET /books/export` 和 `GET /books/:id` 都能匹配 `/books/export`。NestJS 按声明顺序匹配，所以 `export`、`options`、`import-template` 这类**固定路径的方法，要写在 `:id` 方法的前面**。生成的代码已经按这个顺序排好。
:::

## 标准的增删改查接口

代码生成器生成的控制器，包含这些接口（按生成的顺序）：

| 接口 | 生成条件 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET /` | 总是 | `browse` | 分页列表。树表返回整棵树，不分页 |
| `GET /export` | 勾选"导出" | `export` | 导出 Excel |
| `GET /import-template` | 勾选"导入" | `import` | 下载导入模板 |
| `POST /import` | 勾选"导入" | `import` | 导入 Excel |
| `GET /options` | 勾选"下拉接口" | 只需登录 | 给其他模块的下拉框使用 |
| `GET /:id` | 总是 | `view` | 详情 |
| `POST /` | 非只读 | `create` | 新增，返回 201 |
| `PUT /:id` | 非只读 | `modify` | 修改 |
| `PUT /:id/enabled` | 有 `enabled` 列 | `modify` | 启用或停用 |
| `DELETE /:id` | 非只读 | `remove` | 删除一条 |
| `POST /batch-delete` | 非只读、非树表 | `remove` | 批量删除，请求体 `{ ids }` |

只读模块只生成 GET 接口。

## 获取参数

项目注册了一个全局的 zod 校验管道：参数上写了 `schema`，就会先校验、转换，再交给方法；校验不通过直接返回 400。

### 路径参数

```ts
@Get(':id')
get(@Param('id', ParseIntPipe) id: number) { … }
```

URL 里的参数都是字符串，`ParseIntPipe` 把它转成数字，不是数字时返回 400。

### 查询参数

```ts
@Get()
page(@Query({ schema: bookQuery }) query: BookQuery) { … }
```

整个查询对象用一个 zod 规则校验。`?page=2&enabled=true` 进来时是字符串，经过规则之后，`query.page` 是数字 `2`，`query.enabled` 是布尔值 `true`。规则的写法见[参数校验](/core/validation)。

### 请求体

```ts
@Post()
create(@Body({ schema: bookCreate }) dto: BookCreate) { … }

// 也可以直接解构
@Post('batch-delete')
batchRemove(@Body({ schema: idsBody }) { ids }: IdsBody) { … }
```

校验时会**去掉规则里没有定义的字段**，所以前端多传的字段不会进入服务。

### 规则要在运行时才能确定的情况

有些规则依赖后台的配置，比如"密码最少几位"是参数设置里的值。这时控制器接收 `unknown`，由服务读取配置、生成规则，再用 `parseOr400` 校验：

```ts
// user.controller.ts
@Post()
create(@Body() body: unknown) {
  return this.users.create(body)
}

// user.service.ts
import { parseOr400 } from '../../../../core/http/validation.pipe.js'

const { policy } = await this.authParams.load()
const dto = parseOr400(userCreate(policy), body)   // 不通过时抛出 400，格式和自动校验完全一样
```

### 上传文件

```ts
import { UploadFile, type UploadedFileData } from '../../../../core/http/upload.js'

@Post('import')
@HttpCode(200)
@RequirePerm(bookPerms.import)
@Idempotent()                                   // 写在 @UploadFile 上面，文件内容也参与去重
@UploadFile('file', excelImportParams.maxMb, DEFAULT_EXCEL_IMPORT_LIMITS.maxMb)
@ActionLog({ domain: 'demo.book', verb: 'import' })
importXlsx(
  @UploadedFile() file: UploadedFileData | undefined,
  @Body({ schema: importBody }) { mode }: ImportBody,       // 同一个表单里的其他文本字段
) {
  return this.books.importXlsx(file, mode)
}
```

`@UploadFile(字段名, 大小限制的参数键, 默认大小 MB)`：

- 只接收一个文件，保存在内存中；
- 大小上限从[参数设置](/core/param)中读取（参数不存在或无效时使用默认值），超过时返回 413；
- 同一个表单中的其他文本字段，最多 8 个。

`UploadedFileData` 有这几个字段：

| 字段 | 说明 |
| --- | --- |
| `originalname` | 客户端的文件名（只用于显示） |
| `mimetype` | 客户端声称的类型，**不可信**，要按文件内容判断 |
| `size` | 字节数 |
| `buffer` | 文件内容 |

一般的文件上传不需要自己写接口，使用统一的上传接口即可，见[文件上传](/core/upload)。

### 当前用户和请求对象

获取当前用户，**不要**从请求对象里取，使用 CLS：

```ts
import { clsGet } from '../../../../core/context/cls.js'

const me = clsGet('principal')      // { userId, deptId, roles, perms, root, … }
```

确实需要原始请求时（比如读取 IP、设置 cookie），可以使用 `@Req()` 或 `@Res({ passthrough: true })`。项目里只有登录、验证码等少数接口这样做。

## 返回值

**直接返回数据即可**，拦截器会自动包装成统一格式：

| 方法返回 | 客户端收到 |
| --- | --- |
| 一个对象 | `{ "code": 0, "msg": "ok", "data": { … } }` |
| `{ items, total }` | `{ "code": 0, "msg": "ok", "data": { "items": [ … ], "total": 35 } }` |
| 没有返回值（`void`） | `{ "code": 0, "msg": "ok", "data": null }` |
| `StreamableFile` | 文件本身，不包装 |

### 状态码

- 默认：GET、PUT、DELETE 返回 200，POST 返回 **201**；
- **不是"新增"的 POST**（批量删除、导入、发送、执行等），加上 `@HttpCode(200)`。项目里的约定是：只有真正创建了资源的 POST 才返回 201。

### 下载文件

返回 `StreamableFile`，拦截器不会包装它：

```ts
@Get('export')
@RequirePerm(bookPerms.export)
@ActionLog({ domain: 'demo.book', verb: 'export' })
@ApiProduces(XLSX_TYPE)
export(@Query({ schema: bookQuery }) query: BookQuery) {
  return this.excel.export('books', bookColumns, this.books.exportRows(query))   // 返回 StreamableFile
}
```

自己生成文件时：

```ts
import { StreamableFile } from '@nestjs/common'

return new StreamableFile(buffer, {
  type: 'application/zip',
  disposition: 'attachment; filename="codegen.zip"',
})
```

需要完全手动控制响应时（比如按情况返回文件或者 302 跳转），使用 `@Res()`，此时要自己写出响应。项目里只有文件下载接口这样做，一般不需要。

## 自定义操作

标准增删改查之外的操作，写成**子资源**：

```ts
// ✅ 推荐
PUT  /api/iam/users/:id/password         重置密码
PUT  /api/iam/users/:id/roles            分配角色
POST /api/scheduler/tasks/:id/run        立即执行一次

// ❌ 不推荐
POST /api/iam/users/resetPassword?id=3
```

一个完整的自定义操作，项目里的实时推送示例：

```ts
@ApiTags('demo')
@Controller('demo/realtime')
export class DemoRealtimeController {
  constructor(private readonly demo: DemoRealtimeService) {}

  @Post('send')
  @HttpCode(200)                                        // 不是新增
  @RequirePerm(demoRealtimePerms.send)                   // 自定义的权限动作
  @RateLimit(30, 60_000)                                 // 每个 IP 每分钟最多 30 次
  @Idempotent()                                          // 防重复提交
  @ActionLog({ domain: 'demo.realtime', verb: 'send' })  // 操作日志
  @ApiOperation({ summary: 'Push plain text to users, roles or everyone' })
  @ApiEnvelope(demoRealtimeSendVo)
  send(@Body({ schema: demoRealtimeSendBody }) body: DemoRealtimeSendBody) {
    return this.demo.send(body)
  }
}
```

带 `:id` 的自定义操作，服务里要先用 `lockScopedIds` 锁定并检查数据范围，见[服务](/core/service#按-id-修改的标准写法)和[手把手教程](/backend/tutorial)。

## 装饰器一览

### 权限和安全

| 装饰器 | 导入位置 | 说明 |
| --- | --- | --- |
| `@Public()` | `core/auth/decorators.js` | 不需要登录（默认所有接口都需要登录） |
| `@RequirePerm(a, b)` | `core/auth/decorators.js` | 需要其中**任意一个**权限；超级管理员总是通过 |
| `@RequirePerm.all(a, b)` | `core/auth/decorators.js` | 需要**全部**权限 |
| `@RequireRole('code')` | `core/auth/decorators.js` | 需要某个角色（尽量用权限点，不用角色） |
| `@Idempotent({ ttl? })` | `core/guard/idempotent.js` | 防重复提交，默认 3 秒，重复返回 429 |
| `@RateLimit(次数, 毫秒)` | `core/guard/rate-limit.decorator.js` | 按 IP 限流，超出返回 429 |

### 日志

| 装饰器 | 导入位置 | 说明 |
| --- | --- | --- |
| `@ActionLog({ domain, verb, bizId? })` | `core/audit/action-log.js` | 记录操作日志。**每个非 GET 接口必须有它或者 `@SkipActionLog()`** |
| `@SkipActionLog()` | `core/audit/action-log.js` | 明确不记录，旁边要写注释说明原因 |
| `@Sensitive('field')` | `core/redact.js` | 这些字段在所有日志中脱敏 |
| `@SkipHttpTrace()` | `core/audit/http-trace.js` | 不记录 API 访问日志和错误日志 |

### 其他

| 装饰器 | 说明 |
| --- | --- |
| `@UploadFile(字段, 参数键, 默认MB)` | 接收上传文件，见上文 |
| `@HttpCode(200)` | 修改默认状态码 |

### 接口文档（Swagger）

| 装饰器 | 说明 |
| --- | --- |
| `@ApiTags('demo')` | 在接口文档中分组，一般写领域名 |
| `@ApiOperation({ summary })` | 接口说明（英文） |
| `@ApiEnvelope(schema, status?)` | 说明返回的 `data` 是什么结构，自动加上 `code`、`msg`。不传 schema 表示 `data` 为 `null`；新增接口传 `201` |
| `@ApiProduces(XLSX_TYPE)` | 返回的是文件 |
| `@ApiBody({ schema })` | 手动说明请求体（上传接口、运行时规则的接口需要） |

查询参数和请求体的文档，会根据 zod 规则**自动生成**，不需要额外标注。启动后访问 `/api/docs` 即可查看，见[API 约定](/reference/api#接口文档)。

## 自动检查

`pnpm verify` 中的架构检查，会对控制器做这些检查：

| 检查 | 要求 |
| --- | --- |
| action-log | 每个非 GET 接口都有 `@ActionLog` 或 `@SkipActionLog()`；动作名必须在平台的 `VERBS` 或项目的 `PROJECT_ACTION_VERBS` 中登记，项目动作不能和平台重名 |
| scoped-access | 带数据范围的实体，其带 `:id` 或 `ids` 的修改接口，必须经过 `lockScopedIds` |
| no-sql-concat | 不能把变量拼接进 SQL |

## 一个完整的例子

把上面的内容放在一起，一个带自定义操作的业务控制器大致是这样：

```ts
@ApiTags('crm')
@Controller('crm/customers')
export class CustomerController {
  constructor(
    private readonly customers: CustomerService,
    private readonly excel: ExcelService,
  ) {}

  @Get()
  @RequirePerm(customerPerms.browse)
  @ApiOperation({ summary: 'Page of customers' })
  @ApiEnvelope(pageVo(customerVo))
  page(@Query({ schema: customerQuery }) query: CustomerQuery) {
    return this.customers.page(query)
  }

  @Get('export')                                         // 固定路径在 :id 前面
  @RequirePerm(customerPerms.export)
  @ActionLog({ domain: 'crm.customer', verb: 'export' })
  @ApiProduces(XLSX_TYPE)
  export(@Query({ schema: customerQuery }) query: CustomerQuery) {
    return this.excel.export('customers', customerColumns, this.customers.exportRows(query))
  }

  @Get(':id')
  @RequirePerm(customerPerms.view)
  @ApiEnvelope(customerVo)
  get(@Param('id', ParseIntPipe) id: number) {
    return this.customers.get(id)
  }

  @Post()
  @RequirePerm(customerPerms.create)
  @Idempotent()
  @ActionLog({ domain: 'crm.customer', verb: 'create', bizId: (_req, row) => (row as Customer)?.id })
  @ApiEnvelope(customerVo, 201)
  create(@Body({ schema: customerCreate }) dto: CustomerCreate) {
    return this.customers.create(dto)
  }

  @Put(':id/upgrade')                                    // 自定义操作
  @RequirePerm(customerPerms.upgrade)
  @ActionLog({ domain: 'crm.customer', verb: 'upgrade' })
  @ApiOperation({ summary: 'Upgrade a customer to VIP' })
  @ApiEnvelope()
  upgrade(@Param('id', ParseIntPipe) id: number) {
    return this.customers.upgrade(id)
  }
}
```

::: warning 自定义动作名要登记
`@ActionLog` 的 `verb` 必须是已经登记过的动作名，否则 `pnpm verify` 会报错。登记过的动作也是字典 `audit.verb` 的项，操作日志页面靠它显示中英文名称。

**平台已经登记的动作**（在平台文件 `audit.seed.ts` 中，不要修改）：`create` `modify` `remove` `import` `export` `upload` `grant` `revoke` `reset-password` `kick` `publish` `clean` `sync` `run` `test` `send` `approve` `reject` `cancel` 等。**能用平台已有的动作名时，优先用已有的。**

**项目自己的新动作**，登记在项目文件 `apps/server/src/db/seeds/project/action-verbs.seed.ts`：

```ts
export const PROJECT_ACTION_VERBS: ProjectActionVerb[] = [
  // [值, 中文, 英文, 标签颜色（可选）]
  ['upgrade', '升级', 'Upgrade', 'primary'],
]
```

- 值只能用小写字母、数字和短横线（比如 `send-back`），最长 32 个字符；
- **不能和平台的动作重名**，重名时检查会报错，提示改用平台的那个；
- 标签颜色可选：`primary`、`success`、`info`、`warning`、`danger`；
- 执行 `pnpm db:seed` 后，它会作为字典 `audit.verb` 的新项插入（只插入不存在的；管理员改过的名称、删除过的项都不会被覆盖或恢复）。

代码生成器生成的控制器只用平台的动作，所以这个文件只在**手写的自定义操作**需要新动作时才用到。
:::
