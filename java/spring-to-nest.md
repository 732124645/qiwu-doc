---
description: 'Spring Boot 与 NestJS 并排对照：控制器、依赖注入和模块、zod 校验、全局异常、事务、MyBatis 与 TypeORM、配置、拦截器、定时任务、日志和测试。'
---

# Spring Boot 对照 NestJS

下面每一节都把 Spring Boot 的写法和本项目的写法并排放在一起，点击代码块上方的标签即可切换。

## 控制器

::: code-group

```java [Spring Boot]
@RestController
@RequestMapping("/api/iam/positions")
public class PositionController {
    @Autowired
    private PositionService positionService;

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('iam.position.view')")
    public Position get(@PathVariable Long id) {
        return positionService.get(id);
    }

    @PostMapping
    public Position create(@Valid @RequestBody PositionCreate dto) {
        return positionService.create(dto);
    }
}
```

```ts [NestJS（本项目）]
@Controller('iam/positions')                 // 全局前缀 /api 自动加上
export class PositionController {
  constructor(private readonly positions: PositionService) {}   // 构造函数注入

  @Get(':id')
  @RequirePerm(positionPerms.view)
  get(@Param('id', ParseIntPipe) id: number) {
    return this.positions.get(id)
  }

  @Post()
  @RequirePerm(positionPerms.create)
  @Idempotent()
  @ActionLog({ domain: 'iam.position', verb: 'create', bizId: (_req, row) => row?.id })
  create(@Body({ schema: positionCreate }) dto: PositionCreate) {
    return this.positions.create(dto)
  }
}
```

:::

| Spring | NestJS |
| --- | --- |
| `@GetMapping("/{id}")` | `@Get(':id')` |
| `@PathVariable Long id` | `@Param('id', ParseIntPipe) id: number`（URL 参数是字符串，要用管道转成数字） |
| `@RequestParam` | `@Query({ schema })`（整个查询对象用 zod 校验） |
| `@RequestBody @Valid` | `@Body({ schema })` |
| 返回对象 → Jackson 序列化 | 返回对象 → 拦截器包装成 `{ code, msg, data }` 再序列化 |

::: tip 只推荐构造函数注入
NestJS 也支持属性注入，但项目统一使用构造函数注入，这和 Spring 官方推荐的做法一致。
:::

## 服务和依赖注入

::: code-group

```java [Spring Boot]
@Service
public class PositionService {
    private final PositionMapper mapper;

    public PositionService(PositionMapper mapper) {
        this.mapper = mapper;
    }
}
```

```ts [NestJS（本项目）]
@Injectable()
export class PositionService extends BaseCrudService<Position> {
  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost, Position)
  }
}
```

:::

Spring 通过**组件扫描**自动发现 Bean。NestJS **没有组件扫描**，每个服务都要在模块中**显式注册**：

::: code-group

```java [Spring Boot]
// 什么都不用写：@Service 会被组件扫描发现
```

```ts [NestJS（本项目）]
@Module({
  imports: [TypeOrmModule.forFeature([Position])],
  controllers: [PositionController],
  providers: [PositionService],
  exports: [PositionService],      // 别的模块要用时，才需要导出
})
export class PositionModule {}
```

:::

模块是一个明确的边界：**没有导出的服务，其他模块无法注入**。这比 Spring 的"所有 Bean 都在同一个容器里"更严格。

## 参数校验

::: code-group

```java [Spring Boot]
public class PositionCreate {
    @NotBlank @Size(max = 64)
    private String code;

    @Min(0) @Max(999999)
    private Integer sortNo;
}
```

```ts [NestJS（本项目）]
// packages/shared：前后端共用
export const positionCreate = z.object({
  code: z.string().trim().min(1).max(64),
  sortNo: z.number().int().min(0).max(999_999).optional(),
})
export type PositionCreate = z.infer<typeof positionCreate>
```

:::

- 规则放在**共享包**里，前端的 Element Plus 表单用同一份规则做校验；
- 错误提示是翻译键，返回时按请求语言自动翻译；
- 校验失败返回 400，并附上每个字段的错误。

## 全局异常处理

::: code-group

```java [Spring Boot]
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ServiceException.class)
    public AjaxResult handle(ServiceException e) {
        return AjaxResult.error(e.getMessage());
    }
}

// 业务代码
throw new ServiceException("岗位编码已存在");
```

```ts [NestJS（本项目）]
// 全局异常过滤器已经写好了，业务代码只需要抛出异常

throw new BizError(Err.DUPLICATE, { code })   // 409，信息是翻译键
throw new NotFoundException()                  // 404
```

:::

不同之处在于：**错误信息不写在代码里**，而是通过错误码对应一个翻译键，这样同一个错误可以按请求的语言返回中文或英文。HTTP 状态码也是真实的（400、403、404、409、422），而不是一律返回 200。

## 事务

::: code-group

```java [Spring Boot]
@Transactional
public void upgrade(Long id) {
    Customer c = mapper.selectForUpdate(id);
    if (!c.isEnabled()) throw new ServiceException("…");
    mapper.updateLevel(id, "vip");
}
```

```ts [NestJS（本项目）]
upgrade(id: number): Promise<void> {
  return this.txHost.withTransaction(async () => {
    await this.lockScopedIds([id])            // SELECT … FOR UPDATE，并检查数据范围
    const row = await this.repo.findOneByOrFail({ id })
    if (!row.enabled) throw new BizError(Err.CRM_CUSTOMER_DISABLED)
    await this.repo.update(id, { level: 'vip' })
  })
}
```

:::

- 事务的传播方式和 Spring 的 `REQUIRED` 一样：在事务内调用的其他服务方法会**自动加入**当前事务（通过 CLS 传递，不需要传参数）；
- 抛出任何异常都会回滚，不区分受检异常和非受检异常；
- 项目里也可以使用 `@Transactional()` 装饰器，但现有代码统一使用 `withTransaction`，因为它能明确地看出事务包含了哪些代码。

## 数据访问：MyBatis / JPA → TypeORM

::: code-group

```java [MyBatis]
<select id="selectList" resultType="Position">
  SELECT * FROM iam_position
  <where>
    <if test="code != null">AND code LIKE CONCAT('%', #{code}, '%')</if>
    AND del_flag = '0'
  </where>
  ORDER BY sort_no
</select>
```

```ts [TypeORM（本项目）]
protected override filter(qb: SelectQueryBuilder<Position>, { code }: PositionQuery) {
  if (code) qb.andWhere('t.code LIKE :code', { code: contains(code) })
  return qb
}
// 分页、排序、逻辑删除条件、数据范围条件，都由 BaseCrudService 自动加上
```

:::

| MyBatis / JPA | TypeORM |
| --- | --- |
| `#{param}` | `:param` 命名参数 |
| `${param}` 字符串替换 | **禁止使用**（检查脚本会拦截） |
| Mapper XML 的动态 SQL | QueryBuilder 的链式调用 |
| JPA `@Entity` + `@Column` | 写法几乎一样 |
| `@Where(clause = "del_flag = '0'")` | `@DeleteDateColumn`，查询时自动排除 |
| PageHelper `startPage()` | `paginate(qb, query)` |
| 复杂报表 SQL | `this.txHost.tx.query(sql, params)`，写原生 SQL（同样要用参数） |

## 配置

::: code-group

```java [Spring Boot]
# application.yml
server:
  port: 8080

@Value("${server.port}")
private int port;
```

```ts [NestJS（本项目）]
// apps/server/.env
PORT=3000

// 启动时用 zod 校验所有环境变量，缺少或格式不对时拒绝启动
constructor(private readonly cfg: AppConfigService) {}
const port = this.cfg.get('PORT')      // 有类型：number
```

:::

没有 `application-dev.yml` 这样的 profile 文件，而是用不同的 env 文件（`.env`、`.env.test`、`.env.e2e`），密钥单独放在不提交到 git 的 `.env.local` 里。**业务配置**（登录锁定次数、上传大小限制等）不在 env 里，而是在后台的[参数设置](/core/param)中。

## AOP、过滤器、拦截器

| Spring | NestJS |
| --- | --- |
| Servlet `Filter` | 中间件（middleware） |
| `HandlerInterceptor.preHandle` 做登录/权限检查 | 守卫（Guard） |
| `@Aspect` + `@Around` | 拦截器（Interceptor） |
| `HandlerMethodArgumentResolver` | 管道（Pipe）和参数装饰器 |
| `@ControllerAdvice` | 异常过滤器（Exception Filter） |

执行顺序：中间件 → 守卫 → 拦截器（前）→ 管道 → 控制器方法 → 拦截器（后）→ 异常过滤器（出错时）。详见[一个请求的一生](/backend/request-lifecycle)。

## 定时任务

::: code-group

```java [Spring Boot]
@Scheduled(cron = "0 0 2 * * ?")
public void purge() { … }
```

```ts [NestJS（本项目）]
@JobHandler('audit.purge')
async purge(_params: object, { signal, log }: JobContext) { … }
// 执行时间不写在代码里，由管理员在"定时任务"页面配置
```

:::

参见[定时任务](/core/job)。

## 日志

::: code-group

```java [Spring Boot]
private static final Logger log = LoggerFactory.getLogger(NotifyDispatcher.class);
log.warn("send failed: {}", id, e);
```

```ts [NestJS（本项目）]
private readonly logger = new Logger(NotifyDispatcher.name)
this.logger.warn(`send failed: ${id}`)
```

:::

日志底层用的是 pino，输出结构化的 JSON，每一行都带有请求编号 `reqId`（就是 traceId）。

## 测试

::: code-group

```java [JUnit + MockMvc]
@SpringBootTest
@AutoConfigureMockMvc
class PositionControllerTest {
    @Autowired MockMvc mvc;

    @Test
    void forbidden() throws Exception {
        mvc.perform(get("/api/iam/positions/1").header("Authorization", readerToken))
           .andExpect(status().isForbidden());
    }
}
```

```ts [Vitest + supertest（本项目）]
it('403 without iam.position.view', async () => {
  await request(app.getHttpServer())
    .get('/api/iam/positions/1')
    .set(bearer(readerToken))
    .expect(403)
})
```

:::

参见[写测试](/backend/testing)。

## 构建和运行

| Spring Boot | 本项目 |
| --- | --- |
| `mvn spring-boot:run` | `pnpm dev` |
| `mvn package` → `app.jar` | `pnpm -r build` → `dist/` |
| `java -jar app.jar` | `node dist/main.js` |
| DevTools 热重启 | `tsc -w` + `node --watch`，改完一两秒生效 |
