---
description: '写给 Java 开发者的 Node.js 运行模型：单线程事件循环、漏写 await 的坑、避免阻塞主线程、用 CLS 代替 ThreadLocal、并发与锁、数字精度和部署。'
---

# Node.js 和 JVM 的差异

这是 Java 开发者最需要调整思路的地方。语法差异很快就能适应，**运行模型的差异**才是容易踩坑的部分。

## 一个线程，处理所有请求

Tomcat 的模型是：每个请求分配一个线程，线程在等待数据库返回时**阻塞**，其他请求由其他线程处理。

Node.js 的模型是：**只有一个主线程**。它处理请求时遇到 I/O（查数据库、调 Redis、读文件、调外部接口），不会原地等待，而是先把 I/O 交给系统，转头去处理别的请求。I/O 完成后，再回来继续执行后面的代码。这个调度机制叫做**事件循环**（event loop）。

```text
Tomcat                                  Node.js
─────                                   ───────
线程 1：请求 A ──等数据库──▶ 继续      主线程：请求 A ─┐ 发出查询，去做别的
线程 2：请求 B ──等 Redis──▶ 继续              请求 B ─┤ 发出查询，去做别的
线程 3：请求 C ──等数据库──▶ 继续              请求 C ─┘ 发出查询，去做别的
（每个线程大部分时间在等待）             ← 查询 A 返回，继续处理 A
                                         ← 查询 C 返回，继续处理 C …
```

所以 Node 用一个线程就能同时处理成百上千个请求，前提是**每个请求都不要长时间占用主线程**。

## async / await：Node 里的"阻塞调用"

所有 I/O 操作都返回一个 `Promise`（相当于 Java 的 `CompletableFuture`）。用 `await` 等待它的结果，写起来就像同步代码一样：

```ts
async get(id: number): Promise<Position> {
  const row = await this.repo.findOneBy({ id })    // 等待数据库返回，但不会阻塞其他请求
  if (!row) throw new NotFoundException()
  return row
}
```

`await` 只会暂停**当前这个函数**，主线程在这段时间里会去处理别的请求。

### 最常见的错误：忘了写 await

```ts
// ❌ 没有 await：update 还没执行完，函数就返回了；出错时异常也不会被捕获
this.repo.update(id, dto)

// ✅
await this.repo.update(id, dto)
```

Java 里调用一个方法，它一定会执行完才返回；而在 Node 里，调用一个 `async` 方法却不 `await`，就相当于把任务丢出去，**不再管它**。这类问题很难排查：可能会读到旧数据，也可能在事务提交之后才执行，异常也会丢失。

如果确实不需要等待结果（比如记录日志），要显式写出来并处理异常，让读代码的人知道这是故意的：

```ts
void this.audit.write(row).catch((e) => this.logger.warn(e))
```

### 并行执行

几个互相独立的查询，可以同时发出，再一起等待结果：

```ts
// 依次执行：总耗时 = 三次查询的耗时之和
const user = await this.users.get(id)
const roles = await this.roles.of(id)
const depts = await this.depts.tree()

// 并行执行：总耗时 ≈ 最慢的那一次
const [user, roles, depts] = await Promise.all([
  this.users.get(id),
  this.roles.of(id),
  this.depts.tree(),
])
```

::: warning 事务里不要并行执行查询
一个事务只对应一个数据库连接，在同一个连接上并行发送多条语句，没有任何好处，还可能出错。事务内的查询请依次 `await`。
:::

## 不要阻塞主线程

既然只有一个主线程，那么任何长时间占用它的代码，都会让**所有请求**一起卡住：

```ts
// ❌ 同步读取大文件：读取期间所有请求都在排队
const buf = fs.readFileSync('big.xlsx')

// ❌ 一个很大的循环计算：计算期间什么都做不了
for (let i = 0; i < 1e9; i++) { /* … */ }

// ✅ 使用异步 API
const buf = await fs.promises.readFile('big.xlsx')
```

规则很简单：

- **I/O 操作**一律使用异步 API（带 `Sync` 后缀的方法只能在启动脚本里使用）；
- **CPU 密集的计算**（大规模数据处理、复杂加密、图片处理）要放到 `worker_threads` 工作线程里，或者拆分成单独的服务；
- 需要处理大量数据时，**分批进行**，比如 Excel 导出每次只读取 1000 行。

项目里的图片处理用的是 `sharp`，它会在内部的线程池里完成计算，不会占用主线程。

## 没有 ThreadLocal，用 CLS

在 Java 里，"当前请求的用户"通常存放在 `ThreadLocal` 中（Spring Security 的 `SecurityContextHolder` 就是这样做的）。但 Node 只有一个线程，所有请求共用它，`ThreadLocal` 的思路行不通。

Node 的替代方案是 **`AsyncLocalStorage`**：它能在一个请求的整条异步调用链上传递数据，即使中间经过了很多次 `await`。项目通过 `nestjs-cls` 使用它：

```ts
import { clsGet } from '../../../../core/context/cls.js'

const me = clsGet('principal')      // 当前登录用户；定时任务和未登录的接口中为 undefined
const traceId = clsGet('traceId')   // 当前请求的编号
```

事务也是通过 CLS 传递的：在 `withTransaction` 里调用的任何服务方法，都会自动加入同一个事务，不需要把连接或者 `EntityManager` 作为参数传来传去，这一点和 Spring 的 `@Transactional` 很像。

## 并发和锁

因为只有一个线程，**同一个进程里的普通 JS 代码不会被并发执行**，所以不需要 `synchronized`，也不需要 `ConcurrentHashMap`。

但这**不代表**没有并发问题：

- 两个请求都执行到 `await` 时，它们的**数据库操作**是交替执行的。"先查询、再判断、后修改"这种逻辑，仍然需要数据库事务和行锁（`SELECT … FOR UPDATE`，项目里是 `lockScopedIds`）；
- 部署多个实例时，跨进程的互斥要用 Redis 锁。

参见[数据库基础：锁](/backend/database#锁-防止两个人同时修改)和 [RedisLock](/core/guards#redislock-分布式锁)。

## 异常

- `async` 函数里抛出的异常，会变成 Promise 的"拒绝"（rejection），要用 `try/catch` 包住 `await` 来捕获，写法和 Java 一样；
- **没有受检异常**，函数签名里也不需要声明会抛出什么异常；
- 一个 Promise 被拒绝了却没有人处理（通常是因为忘了写 `await`），Node 默认会**让整个进程退出**。这又是"一定要写 await"的原因之一。

在控制器和服务中，直接抛出异常就行（`throw new NotFoundException()`、`throw new BizError(...)`），全局异常过滤器会把它转换成统一格式的错误响应。

## 数字

JavaScript 只有一种数字类型 `number`，也就是 Java 的 `double`：

| Java | 本项目 | 注意 |
| --- | --- | --- |
| `int` / `long` | `number` | 超过 2⁵³（约 9 千万亿）的整数会丢失精度。自增 id 远远达不到这个值 |
| `BigDecimal` | `number`（`decimal` 列被转换为数字） | 适合金额这类 15 位以内的有效数字。更高的精度要保留字符串 |
| `BigInteger` | `bigint` | 很少用到 |

代码生成器支持的数值精度上限是：`bigint` 不超过 2⁵³，`decimal` 不超过 15 位有效数字。

## 部署和进程

- **没有 JVM 调优**：启动只需要一两秒，内存占用通常只有一两百 MB。遇到内存不足时，可以用 `node --max-old-space-size=2048` 调整堆内存上限；
- **一个进程只使用一个 CPU 核**。要用满多核，就启动多个实例，前面加负载均衡。项目支持多实例部署：限流计数和实时推送都通过 Redis 在实例之间共享，但部署要满足一些条件，比如 Redis 7 以上、各实例的配置和密钥相同、本地文件放在共享存储上或者改用 S3（参见[部署 · 多实例部署](/guide/deploy#多实例部署)）；
- **进程守护**：用 systemd、容器的重启策略，或者 PM2。PM2 是 AGPL 协议，只能在服务器上全局安装、当作运维工具用，不能加进项目的依赖（`package.json`），见[部署 · 使用 PM2 守护进程](/guide/deploy#使用-pm2-守护进程-可选)。

## 包管理

| Maven | pnpm |
| --- | --- |
| `pom.xml` | `package.json` |
| `mvn install` | `pnpm i` |
| 本地仓库 `~/.m2` | pnpm 全局存储（硬链接，节省空间） |
| 多模块项目 | pnpm workspace（`apps/*`、`packages/*`） |
| `<dependencyManagement>` | `pnpm-workspace.yaml` 中的 `catalog` |

项目对依赖要求严格：新增依赖时，必须检查许可证（`pnpm license:check`），并且在 `pnpm-workspace.yaml` 的 `allowBuilds` 中登记是否允许执行安装脚本。刚发布不到 24 小时的新版本不允许安装，以防供应链投毒。
