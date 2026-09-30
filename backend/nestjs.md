# NestJS 基础

NestJS 是一个 Node.js 后端框架。它的设计参考了 Java 的 Spring 和前端的 Angular，核心只有几个概念：**模块、控制器、服务、依赖注入**，外加**装饰器**这种写法。

本章全部用项目里的"岗位"模块举例，文件在 `apps/server/src/modules/platform/iam/position/`。

## 装饰器：以 `@` 开头的那些东西

先解决最常见的困惑：代码里到处都是 `@Get()`、`@Injectable()`，这是什么？

```ts
@Controller('iam/positions')
export class PositionController {
  @Get(':id')
  @RequirePerm(positionPerms.view)
  get(@Param('id', ParseIntPipe) id: number) { /* … */ }
}
```

**装饰器就是给类、方法或参数"贴标签"。** 标签本身什么也不做，框架启动时会读取这些标签，再决定怎么处理。上面这段代码的意思是：

- `@Controller('iam/positions')`：这个类负责处理 `/api/iam/positions` 下的请求；
- `@Get(':id')`：`get` 方法处理 `GET /api/iam/positions/:id`；
- `@RequirePerm(...)`：调用这个方法需要 `iam.position.view` 权限（`PermGuard` 会读取这个标签）；
- `@Param('id', ParseIntPipe)`：取出 URL 里的 `:id`，转换成整数后传给参数 `id`。如果不是数字，直接返回 400。

你可以把它类比成 Vue 的 `defineProps`：都是一种**声明**，而不是需要执行的逻辑。

## 控制器 Controller：路由表

控制器决定"**哪个地址由哪个函数处理**"。常用的装饰器：

| 装饰器 | 作用 |
| --- | --- |
| `@Get()` `@Post()` `@Put()` `@Delete()` | HTTP 方法和路径 |
| `@Param('id')` | URL 路径参数 `/positions/:id` |
| `@Query({ schema })` | URL 查询参数 `?page=1`，并用 zod 校验 |
| `@Body({ schema })` | 请求体（JSON），并用 zod 校验 |
| `@RequirePerm(...)` | 需要的权限（项目自定义） |
| `@ActionLog({...})` | 记录操作日志（项目自定义） |
| `@Idempotent()` | 防止重复提交（项目自定义） |
| `@Public()` | 不需要登录就能访问（项目自定义） |
| `@ApiOperation` `@ApiEnvelope` | 生成 Swagger 接口文档 |

岗位的新增接口是一个典型的例子：

```ts
@Post()
@RequirePerm(positionPerms.create)
@Idempotent()                                  // 3 秒内的重复提交返回 429
@ActionLog({ domain: 'iam.position', verb: 'create', bizId: (_req, row) => row?.id })
@ApiOperation({ summary: 'Add a position' })
@ApiEnvelope(positionVo, 201)
create(@Body({ schema: positionCreate }) dto: PositionCreate) {
  return this.positions.create(dto)
}
```

::: tip 路由顺序
`GET /positions/options` 和 `GET /positions/:id` 都能匹配 `/positions/options`。NestJS 按声明顺序匹配，所以**固定路径要写在 `:id` 前面**。生成器已经处理好了这一点，自己加路由时要注意。
:::

## 服务 Service：业务逻辑

服务是真正干活的地方。标准的增删改查已经由基类 `BaseCrudService` 实现，岗位服务只需要写查询条件和下拉选项：

```ts
@Injectable()                                        // 声明"这个类可以被注入"
export class PositionService extends BaseCrudService<Position> {
  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost, Position)
  }

  protected override filter(qb, { code, name, enabled }: PositionQuery) {
    if (code) qb.andWhere('t.code LIKE :code', { code: contains(code) })
    // …
    return qb
  }

  options(): Promise<PositionOption[]> {
    return this.scopedQb('t')
      .select(['t.id', 't.name'])
      .andWhere('t.enabled = :enabled', { enabled: true })
      .orderBy('t.sortNo')
      .getMany()
  }
}
```

`BaseCrudService` 提供了这些方法，子类可以直接使用，也可以覆写：

| 方法 | 作用 |
| --- | --- |
| `page(query)` | 分页列表 |
| `get(id)` | 按 id 查一条，不存在或超出数据范围时返回 404 |
| `create(dto)` | 新增 |
| `update(id, dto)` | 修改（只改传了的字段） |
| `remove(ids)` | 删除（逻辑删除，被引用时返回 409） |
| `exportRows(query)` | 分批读取，用于导出 Excel |
| `scopedQb(alias)` | 得到一个**已经加好数据范围条件**的查询构造器，所有读取都应该从这里开始 |
| `lockScopedIds(ids)` | 在事务里锁定这些记录，并确认它们都在数据范围内 |
| `assertUnique(field, value)` | 检查唯一性，重复时返回 409 |

::: warning 为什么控制器不直接查数据库？
理论上可以，但不要这样做。把逻辑放在服务里有三个好处：可以被其他模块复用（比如工作流要查用户）；更容易测试；数据范围、事务这些规则都集中在一个地方。
:::

## 依赖注入：`constructor` 里的参数从哪来？

注意控制器的构造函数：

```ts
constructor(
  private readonly positions: PositionService,
  private readonly excel: ExcelService,
) {}
```

我们从来没有写过 `new PositionService()`，那 `this.positions` 是从哪里来的？

答案是 **NestJS 帮你创建好并传了进来**，这就叫**依赖注入**（Dependency Injection，DI）。它和 Vue 的 `provide` / `inject` 是同一个思想：

| Vue | NestJS |
| --- | --- |
| 父组件 `provide('key', value)` | 模块 `providers: [PositionService]` |
| 子组件 `inject('key')` | 构造函数参数 `positions: PositionService` |

NestJS 通过**参数的类型**来判断要注入什么。所以类型不能只写成 `import type`，否则运行时类型信息就没了。

好处是：

- 同一个服务在整个应用里只有**一个实例**（单例），所有地方共用；
- 测试时可以很方便地替换成假的实现。

## 模块 Module：把东西组装起来

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Position])],   // 这个模块要用到 Position 表
  controllers: [PositionController],                  // 这个模块的控制器
  providers: [PositionService],                       // 这个模块可以注入的服务
})
export class PositionModule {}
```

模块再一层层注册到上级模块：`PositionModule` → `IamModule` → `PlatformModule` → `AppModule`。

项目的业务模块统一注册在 `apps/server/src/modules/project.module.ts`：

```ts
@Module({
  imports: [BookModule, TopicModule, InvoiceModule, DemoRealtimeModule, LeaveModule],
})
export class ProjectModule {}
```

**新模块忘记注册，接口就会返回 404。** 这是新手最常遇到的问题之一。

### 想用别的模块的服务怎么办？

对方模块要在 `exports` 里导出这个服务，你的模块再在 `imports` 里导入对方模块。另外还要遵守分层规则：`platform` 不能依赖 `biz`，详见[目录结构](/guide/structure#分层规则)。

## 守卫、管道、拦截器、过滤器

这四个概念都是"**在控制器方法前后插入的逻辑**"，区别在于它们各自负责什么：

| 类型 | 什么时候执行 | 负责什么 | 前端类比 | 项目中的例子 |
| --- | --- | --- | --- | --- |
| 守卫 Guard | 最先执行 | 能不能访问 | `router.beforeEach` | `AuthGuard`、`PermGuard` |
| 管道 Pipe | 调用方法前 | 校验和转换参数 | 表单校验 | `ZodValidationPipe` |
| 拦截器 Interceptor | 方法前后 | 加工返回值、记日志 | axios 拦截器 | `EnvelopeInterceptor`、`@ActionLog`、`@Idempotent` |
| 过滤器 Filter | 出错时 | 把异常转换成统一的错误响应 | `app.config.errorHandler` | `HttpErrorFilter` |

这些项目都已经配置好了，平时你只需要**在方法上加装饰器**，不需要自己写守卫或拦截器。

## 抛出错误

在服务里遇到不符合业务规则的情况，直接抛出异常，框架会自动转换成对应的 HTTP 响应：

```ts
import { NotFoundException } from '@nestjs/common'
import { Err } from '@qiwu/shared'
import { BizError } from '../../../../core/http/biz-error.js'

throw new NotFoundException()                        // 404
throw new BizError(Err.DUPLICATE, { code: 'dev' })   // 409，带翻译好的错误信息
```

`BizError` 会带上错误码和翻译键，前端收到的 `msg` 已经是翻译好的文字。怎么定义自己的错误码，请看[手把手教程](/backend/tutorial)。

## ESM 的一个小坑

项目使用 ES 模块，所以**相对路径导入必须写 `.js` 后缀**，即使源文件是 `.ts`：

```ts
import { PositionService } from './position.service.js'   // ✅
import { PositionService } from './position.service'      // ❌ 运行时找不到文件
```

这是 Node.js 的规定：TypeScript 编译时不会修改导入路径，运行时加载的是编译出来的 `.js` 文件。
