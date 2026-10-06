---
description: '跟着一次岗位列表查询，从页面、axios 拦截器、Vite 代理走到 NestJS 的中间件、守卫、管道、控制器、服务和 SQL，再回到页面，建立对后端的整体印象。'
---

# 一个请求的一生

学后端最快的方法，是跟着一个请求走完全程。我们以 **"在岗位管理页面按编码搜索"** 为例，看它从浏览器出发，到数据库，再回到页面，一共经过了哪些地方。

```text
浏览器                          服务端（NestJS）                         数据库
──────                          ───────────────                          ──────
① 页面 useCrudList
② api/position.ts
③ axios 拦截器（加令牌）
④ Vite 代理 ──────────────▶ ⑤ 中间件（安全头、cookie）
                             ⑥ 守卫：登录了吗？有权限吗？
                             ⑦ 管道：参数格式对吗？
                             ⑧ 控制器 page()
                             ⑨ 服务 filter() ─────────────────▶ ⑩ SQL 查询
                             ⑪ 拦截器：包装成 {code,msg,data} ◀──
⑫ axios 拦截器（解包）◀─────
⑬ 表格显示
```

下面一步一步看。

## ① 页面：用户点了"搜索"

`apps/web/src/views/platform/iam/position/index.vue`：

```ts
const { query, rows, total, search /* … */ } = useCrudList({
  api: positionApi,
  filters: { code: '', name: '', enabled: null as string | null },
  sort: 'sortNo',
})
```

`useCrudList` 是项目自带的组合式函数，负责管理查询条件、分页、加载状态。点击搜索按钮时，它会调用 `positionApi.page(query)`。

## ② 接口封装

`apps/web/src/api/platform/iam/position.ts`：

```ts
const BASE = '/iam/positions'

export const positionApi = {
  ...crudApi<PositionVo, PositionCreate>(BASE),   // page / get / create / update / remove / exportFile
  setEnabled: (id: number, enabled: boolean) => api.put(`${BASE}/${id}/enabled`, { enabled }),
  options: () => api.get<PositionOption[]>(`${BASE}/options`),
}
```

`page(query)` 最终发出的请求是：

```http
GET /api/iam/positions?page=1&pageSize=20&sort=sortNo&code=dev
```

## ③ axios 请求拦截器

`apps/web/src/core/request/http.ts` 会给每个请求自动加上这些请求头：

```ts
config.headers.Authorization = `Bearer ${accessToken.value}`    // 你是谁（登录令牌）
config.headers['Accept-Language'] = currentLocale()              // 用什么语言回复我
config.headers['X-Request-Id'] = crypto.randomUUID()             // 这次请求的编号，用来排查问题
config.headers['X-Timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone  // 我的时区
```

## ④ Vite 代理

开发时前端运行在 5173 端口，后端运行在 3000 端口。Vite 会把 `/api` 开头的请求转发给 `http://localhost:3000`。所以浏览器认为自己在访问同一个网站，不存在跨域问题。

生产环境由 nginx 做同样的转发。

## ⑤ 中间件

请求到达 NestJS 后，先经过几个**中间件**。中间件就是"每个请求都要经过的函数"，这里主要有：

- `helmet`：加上各种安全相关的响应头；
- `cookie-parser`：解析 cookie（刷新令牌就放在 cookie 里）。

## ⑥ 守卫：你能进来吗？

**守卫**（Guard）相当于前端的 `router.beforeEach`，它只回答一个问题："这个请求能不能继续往下走？"

项目注册了三个全局守卫，每个请求都按顺序经过：

1. **`DemoModeGuard`**：只在开启演示模式（`APP_DEMO_MODE=true`，公开演示站用的只读模式）时起作用。除了登录、退出、保存个人偏好等少数几个接口，其他写操作（非 GET 请求）一律返回 **403**。没开演示模式时直接放行。
2. **`AuthGuard`**：从 `Authorization` 头里取出令牌，到 Redis 里查这个令牌对应的会话。查不到就返回 **401**（未登录）。
3. **`PermGuard`**：读取控制器方法上的 `@RequirePerm(...)`，检查当前用户是否拥有这个权限。没有就返回 **403**（没有权限）。

岗位列表方法上声明的权限是：

```ts
@Get()
@RequirePerm(positionPerms.browse)     // 'iam.position.browse'
```

## ⑦ 管道：参数格式对吗？

**管道**（Pipe）负责校验和转换参数，相当于前端的表单校验。

```ts
page(@Query({ schema: positionQuery }) query: PositionQuery) {
```

`@Query({ schema: positionQuery })` 的意思是：用 `positionQuery` 这个 zod 规则校验 URL 上的查询参数。它定义在共享包里：

```ts
// packages/shared/src/platform/iam/position.schema.ts
export const positionQuery = pageQuery(['sortNo', 'code', 'name', 'createdAt', 'id'])  // 允许排序的字段
  .extend({
    code: z.string().trim().max(64).optional(),
    name: z.string().trim().max(64).optional(),
    enabled: z.stringbool().optional(),        // URL 里的 "true" 字符串 → 布尔值 true
  })
```

有两点要注意：

- URL 参数全都是**字符串**，`page=1` 传过来是 `"1"`。zod 会把它转换成数字，所以控制器拿到的 `query.page` 已经是数字 `1`。
- 校验不通过（比如 `pageSize=99999`），直接返回 **400**，并附上每个字段的错误信息。**请求根本不会到达控制器。**

前端的表单用的也是**同一个共享包里的规则**，所以两边的校验永远一致。

## ⑧ 控制器

```ts
@Controller('iam/positions')            // 这个类处理 /api/iam/positions 下的请求
export class PositionController {
  constructor(private readonly positions: PositionService) {}   // 依赖注入，见下一章

  @Get()                                // GET /api/iam/positions
  @RequirePerm(positionPerms.browse)
  page(@Query({ schema: positionQuery }) query: PositionQuery) {
    return this.positions.page(query)   // 交给服务处理
  }
}
```

控制器应该很"薄"：它只负责声明路由、权限和参数，**真正的业务逻辑放在服务里**。这和"组件只管展示，逻辑放在组合式函数里"是同一个思路。

## ⑨ 服务：拼查询条件

`PositionService` 继承自项目的 `BaseCrudService`。`page()` 方法是基类提供的，子类只需要写"查询条件怎么拼"：

```ts
protected override filter(qb, { code, name, enabled }: PositionQuery) {
  if (code) qb.andWhere('t.code LIKE :code', { code: contains(code) })
  if (enabled !== undefined) qb.andWhere('t.enabled = :enabled', { enabled })
  return qb
}
```

`qb` 是 **QueryBuilder**，可以理解为"用 JS 一步步拼出 SQL"。

注意 `:code` 这种写法：值**不是直接拼进 SQL 字符串**，而是作为参数单独传给数据库。这样可以防止 SQL 注入，详见[数据库基础](/backend/database#sql-注入)。

## ⑩ 数据库

最终执行的 SQL 大致是这样（简化后）：

```sql
SELECT t.id, t.code, t.name, t.sort_no, t.enabled, …
FROM iam_position t
WHERE t.deleted_at IS NULL          -- 自动加上：排除已删除的
  AND t.code LIKE ?                 -- ? 的值是 '%dev%'
ORDER BY t.sort_no ASC
LIMIT 20 OFFSET 0;

SELECT COUNT(*) FROM iam_position t WHERE t.deleted_at IS NULL AND t.code LIKE ?;  -- 总数，用于分页
```

如果这个表声明了数据范围（比如用户表），这里还会自动加上 `AND t.dept_id IN (...)` 这样的条件。岗位表没有部门字段，所以没有这一项。

## ⑪ 拦截器：包装返回值

服务返回的是 `{ items: [...], total: 35 }`。**拦截器** `EnvelopeInterceptor` 会把它统一包装成：

```json
{ "code": 0, "msg": "ok", "data": { "items": [ … ], "total": 35 } }
```

所以你写控制器时直接 `return` 数据就行，不用每次手写 `{ code: 0, ... }`。

如果中途任何一步出错（抛出异常），会由**异常过滤器** `HttpErrorFilter` 统一处理：把错误翻译成请求的语言，加上 `traceId`，并返回正确的 HTTP 状态码。

## ⑫ axios 响应拦截器

回到前端，`http.ts` 的响应拦截器会：

- 成功时：取出 `data` 部分交给调用方，所以 `api.page()` 直接拿到 `{ items, total }`；
- 返回 401 时：用刷新令牌换一个新的访问令牌，然后**自动重发**刚才的请求，用户察觉不到；
- 返回 403、409、422、429 或 5xx 时：直接弹出后端返回的错误信息（已经翻译好了）。

## ⑬ 页面更新

`useCrudList` 把结果写入 `rows` 和 `total`，表格和分页随之更新。

## 总结

| 阶段 | 负责的事 | 失败时 |
| --- | --- | --- |
| 守卫 | 登录了吗？有权限吗？ | 401 / 403 |
| 管道 | 参数格式对吗？ | 400 |
| 控制器 | 把请求交给对应的服务方法 | — |
| 服务 | 业务规则、查询和修改数据 | 404 / 409 / 422 |
| 拦截器 | 包装返回值、记日志 | — |
| 异常过滤器 | 把错误翻译成统一格式 | — |

理解了这张表，你就理解了这个后端的骨架。下一章会详细讲[控制器、服务和模块](/backend/nestjs)。
