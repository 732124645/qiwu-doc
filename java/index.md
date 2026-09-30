# 先看这里：写给 Java 开发者

如果你一直用 Spring Boot 写后端，用过 RuoYi 这类后台框架，这一栏是为你准备的。

好消息是：**后端的概念你都懂**。权限、数据范围、事务、迁移、缓存、定时任务……这些在这个项目里都有，思路也和你熟悉的差不多。NestJS 本身就借鉴了 Spring 的设计，控制器、服务、依赖注入、装饰器（相当于注解），你一看就明白。

你需要补的主要是三块：

1. **运行时的差异**：Node.js 是单线程 + 事件循环，没有线程池。很多 Java 里的习惯（阻塞调用、`ThreadLocal`、`synchronized`）在这里要换一种写法；
2. **TypeScript 的特点**：类型只在编译时存在，运行时会被擦除。所以请求参数的校验不能依赖类型；
3. **前端**：这个项目是全栈的，写一个功能通常也要写 Vue 页面。

## 学习路线

1. **[Node.js 和 JVM 的差异](/java/node-runtime)**：事件循环、async/await、CPU 密集任务、`ThreadLocal` 的替代品。**最重要的一章，建议先读。**
2. **[TypeScript 速成](/java/typescript)**：只讲和 Java 不一样的地方。
3. **[Spring Boot 对照 NestJS](/java/spring-to-nest)**：`@RestController`、`@Autowired`、`@Transactional`、`@Valid` 在这里分别怎么写，两边代码并排对照。
4. **[从 RuoYi 过来](/java/from-ruoyi)**：`@PreAuthorize`、`@DataScope`、`@Log`、`AjaxResult` 这些，在本项目里对应什么。
5. **[前端速成：Vue 3](/java/vue-primer)**：够你看懂和修改生成的页面。
6. 然后直接去看 **[手把手：加一个自定义操作](/backend/tutorial)**，完整做一个功能。

"后端入门"栏目是写给前端开发者的，其中[数据库基础](/backend/database)、[登录是怎么回事](/backend/auth)对你来说大部分是已知内容，可以快速浏览，重点看项目特有的约定（逻辑删除的 `alive` 列、为什么不用外键、为什么不用 JWT）。

## 一张总对照表

| Java / Spring / RuoYi | 本项目 |
| --- | --- |
| Maven / Gradle | pnpm（workspace 单仓库） |
| `pom.xml` | `package.json` |
| Spring Boot | NestJS 12 |
| 注解 `@Xxx` | 装饰器 `@Xxx()`（注意有括号） |
| `@RestController` + `@RequestMapping` | `@Controller('path')` |
| `@Service` + `@Autowired` | `@Injectable()` + 构造函数注入 |
| `@Configuration` / 自动配置 | `@Module({ imports, providers })` |
| `@Valid` + JSR-303 | zod 规则（前后端共用） |
| `@ControllerAdvice` | 全局异常过滤器（已经写好了） |
| `@Transactional` | `txHost.withTransaction()` 或 `@Transactional()` |
| MyBatis / JPA | TypeORM |
| Flyway / Liquibase | TypeORM 迁移 |
| `application.yml` + `@Value` | `.env` + `AppConfigService`（启动时用 zod 校验） |
| `ThreadLocal` | CLS（基于 Node 的 `AsyncLocalStorage`） |
| JUnit + MockMvc | Vitest + supertest |
| Quartz | `@JobHandler` + `@nestjs/schedule` |
| Spring Security + JWT | 自研的不透明令牌 + Redis |
| `@PreAuthorize("@ss.hasPermi('system:user:list')")` | `@RequirePerm('iam.user.browse')` |
| `@DataScope` | 实体上的 `@DataScoped({...})` |
| `@Log(title, businessType)` | `@ActionLog({ domain, verb })` |
| `@RepeatSubmit` | `@Idempotent()` |
| `AjaxResult` / `TableDataInfo` | `{ code, msg, data }` / `{ items, total }` |
| Velocity 代码生成模板 | EJS 模板 |
| Thymeleaf / 前后端分离的 Vue 2 | Vue 3 + Element Plus（同一个仓库） |

## 选 Node 的得与失

实事求是地说：

**得到的：**

- **前后端同一种语言**：同一个 zod 规则，同时用于后端校验、前端表单和接口文档；类型也共用，前端调用接口时有完整的类型提示；
- **开发反馈快**：修改后一两秒就生效，不需要等待编译和重启；
- **I/O 密集场景效率高**：一个进程就能处理大量并发请求，内存占用小。

**需要注意的：**

- **CPU 密集的计算会阻塞整个进程**，需要放到工作线程或单独的服务里（详见下一章）；
- **企业级生态没有 Java 厚**：流程引擎、报表、某些国产中间件的 SDK，Java 选择更多。本项目的流程引擎就是自研的；
- **数字精度**：JavaScript 的 `number` 是双精度浮点数，超过 2⁵³ 的整数和高精度小数需要特别处理（详见 [TypeScript 速成](/java/typescript)）。
