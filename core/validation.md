---
description: '用 zod 在共享包里定义前后端共用的校验规则：常用写法、blankAsNull、错误提示和字段名的翻译、校验失败的 400 返回格式，以及依赖运行时配置的规则。'
---

# 参数校验

项目用 **zod** 定义校验规则。规则写在共享包里，**前端表单和后端接口使用同一份规则**，改一处，两边同时生效。

## 一个模块的规则文件

每个模块在 `packages/shared/src/<分组>/<领域>/<业务>.schema.ts` 中定义这些内容（以图书为例）：

```ts
import { z } from 'zod'
import { pageQuery } from '../../common/pagination.js'
import { fieldDomains } from '../../validation/zod-i18n.js'

/** 权限点 */
export const bookPerms = {
  browse: 'demo.book.browse',
  view: 'demo.book.view',
  create: 'demo.book.create',
  modify: 'demo.book.modify',
  remove: 'demo.book.remove',
  export: 'demo.book.export',
  import: 'demo.book.import',
} as const

/** 新增的请求体 */
export const bookCreate = z
  .object({
    isbn: z.string().trim().min(1).max(20),
    title: z.string().trim().min(1).max(200),
    price: z.number().min(-99_999_999.99).max(99_999_999.99).multipleOf(0.01).optional(),
    publishedOn: z.iso.date().nullish(),
    enabled: z.boolean().optional(),
  })
  .register(fieldDomains, { domain: 'demo.book' })       // 字段名翻译用 field.demo.book.*
export type BookCreate = z.infer<typeof bookCreate>

/** 修改的请求体：所有字段都可选，传了哪个改哪个 */
export const bookUpdate = bookCreate.partial().register(fieldDomains, { domain: 'demo.book' })
export type BookUpdate = z.infer<typeof bookUpdate>

/** 列表的查询参数 */
export const bookQuery = pageQuery(['sortNo', 'title', 'price', 'createdAt', 'id'])
  .extend({
    title: z.string().trim().max(200).optional(),
    enabled: z.stringbool().optional(),
    publishedOnFrom: z.iso.date().optional(),
    publishedOnTo: z.iso.date().optional(),
  })
  .register(fieldDomains, { domain: 'demo.book' })
export type BookQuery = z.output<typeof bookQuery>        // 查询用 z.output（经过转换之后的类型）

/** 返回给前端的数据结构（用于接口文档和前端类型） */
export const bookVo = z.object({
  id: z.number().int(),
  isbn: z.string(),
  title: z.string(),
  price: z.number(),
  publishedOn: z.string().nullable(),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
  // …
})
export type BookVo = z.infer<typeof bookVo>
```

| 规则 | 用在哪里 |
| --- | --- |
| `xxxCreate` | 新增接口的 `@Body`、前端新增表单的校验 |
| `xxxUpdate` | 修改接口的 `@Body` |
| `xxxQuery` | 列表接口的 `@Query` |
| `xxxVo` | 接口文档、前端的类型 |

::: info Vo 规则不会过滤返回值
`xxxVo` 只用于生成接口文档和前端类型，**不会**在运行时过滤服务的返回值。不能返回给前端的字段（比如密码哈希），要在实体上设置 `select: false`，或者在服务中手动组装返回的对象。
:::

## 常用规则

### 文字

```ts
z.string().trim().min(1).max(64)                  // 必填，去掉首尾空格，1 到 64 个字
z.string().trim().max(500).nullish()              // 可以不传、可以为 null
blankAsNull(z.string().trim().max(32))            // 空字符串当作 null（见下文）
z.string().regex(/^[\w.@-]+$/)                    // 正则
z.string().trim().max(128).pipe(z.email())        // 邮箱
```

### 数字

```ts
z.number().int().min(0).max(999_999)             // 整数
z.number().min(0).multipleOf(0.01)                // 两位小数（金额）
z.number().int().positive()                       // 正整数（比如 id）
```

### 其他

```ts
z.boolean()                                       // 请求体里的布尔值
z.stringbool()                                    // 查询参数里的布尔值："true"/"false" → true/false
z.iso.date()                                      // 日期 YYYY-MM-DD
z.iso.datetime({ offset: true })                  // 时间，带时区
z.enum(['insert', 'upsert'])                      // 只能是其中之一
z.array(z.number().int().positive()).min(1).max(200)   // id 数组
```

::: tip 查询参数和请求体的区别
URL 里的查询参数**全都是字符串**，所以查询规则里的布尔值要用 `z.stringbool()`，数字要用 `z.coerce.number()`（`pageQuery` 已经处理好了分页参数）。请求体是 JSON，直接用 `z.boolean()`、`z.number()`。
:::

### blankAsNull：可选字段的空值

表单里清空一个可选字段（比如手机号）时，前端发来的是空字符串 `''`。`blankAsNull` 会把它变成 `null`，这样：

- 不会因为"格式不对"而校验失败（空字符串不符合手机号的正则）；
- 不会在唯一索引中冲突（两个用户的手机号都是 `''` 会被认为重复，都是 `null` 则不会）。

```ts
import { blankAsNull } from '../../common/crud.js'

mobile: blankAsNull(z.string().trim().max(32).regex(/^\+?\d[\d-]{4,30}$/)),
```

### 共享包中的通用规则

| 规则 | 说明 |
| --- | --- |
| `pageQuery(可排序字段)` | 分页查询的基础规则 |
| `idsBody` | `{ ids: number[] }`，1 到 200 个，批量删除用 |
| `enabledBody` | `{ enabled: boolean }` |
| `importBody` | `{ mode: 'insert' \| 'upsert' }`，导入用 |
| `blankAsNull(schema)` | 空字符串当作 null |
| `masked.mobile` 等 | 脱敏显示（手机号、邮箱、身份证、银行卡） |

## 错误提示的翻译

**规则里不写提示文字。** 项目统一把 zod 的错误转换成翻译键：

| 错误 | 翻译键 | 中文 |
| --- | --- | --- |
| 必填 | `validation.required` | {field}不能为空 |
| 字符串太短 | `validation.too_small.string` | {field}至少 {minimum} 个字符 |
| 字符串太长 | `validation.too_big.string` | {field}最多 {maximum} 个字符 |
| 数字太小 | `validation.too_small.number` | {field}不能小于 {minimum} |
| 不是整数 | `validation.integer` | {field}必须是整数 |
| 格式不对 | `validation.invalid_format.other` | {field}的格式不正确 |
| 邮箱格式 | `validation.invalid_format.email` | {field}不是有效的邮箱地址 |
| 不在可选范围 | `validation.invalid_value` | {field}只能是：{values} |

`{field}` 是**字段名**，按这个顺序查找翻译：

1. `field.<领域>.<属性>`，比如 `field.demo.book.isbn`（由 `.register(fieldDomains, { domain: 'demo.book' })` 决定领域）；
2. `field.common.<属性>`；
3. 都没有时，用 `field.common.input`。

字段名的翻译放在共享包里（后端返回错误时也要用到）：

```text
packages/shared/src/i18n/zh-CN/modules/demo.book.json
packages/shared/src/i18n/en-US/modules/demo.book.json
```

```json
{
  "field": {
    "demo": {
      "book": {
        "isbn": "ISBN",
        "title": "书名",
        "publishedOnFrom": "出版日期起",
        "publishedOnTo": "出版日期止"
      }
    }
  }
}
```

范围查询的 `xxxFrom` / `xxxTo` 也需要单独写字段名。

### 自定义错误提示

某条规则需要特别的提示时，指定一个翻译键：

```ts
z.string().refine(isStrongEnough, { error: 'validation.password.char_classes' })
```

然后在 `packages/shared/src/i18n/{zh-CN,en-US}/validation.json` 中加上这个键的翻译。

## 校验失败时返回什么

```http
HTTP/1.1 400 Bad Request
```

```json
{
  "code": "A0401",
  "msg": "书名不能为空",
  "data": null,
  "errors": [
    { "path": "title", "msg": "书名不能为空" },
    { "path": "price", "msg": "定价不能小于 0" }
  ],
  "traceId": "6f1c…"
}
```

`msg` 是第一个错误，`errors` 列出所有错误。前端的表单组件会直接使用前端的校验结果，这个响应主要在前端校验被绕过时才会出现。

## 运行时才能确定的规则

有些规则依赖后台的配置，比如"密码至少几位"来自参数设置。这时把规则写成**函数**：

```ts
// packages/shared：根据密码策略生成规则
export function userCreate(policy: PasswordPolicy) {
  return userFields
    .extend({ password: blankAsNull(passwordSchema(policy)) })
    .register(fieldDomains, { domain: 'iam.user' })
}
export type UserCreate = z.infer<ReturnType<typeof userCreate>>
```

控制器接收 `unknown`，服务中读取配置、生成规则，再用 `parseOr400` 校验：

```ts
// user.service.ts
import { parseOr400 } from '../../../../core/http/validation.pipe.js'

async createUser(body: unknown) {
  const { policy } = await this.authParams.load()
  const { password, ...dto } = parseOr400(userCreate(policy), body)     // 失败时返回 400，格式同上
  // …
}
```

前端的表单也用同样的方式，从 `/me` 接口拿到当前的密码策略，再生成规则。

## 规则的执行方式

- 控制器参数上写了 `{ schema }`，全局的校验管道就会执行它：**校验、转换类型、填充默认值、去掉未定义的字段**，然后才交给方法；
- 前端 `useCrudForm` 会把同一个规则转换成 Element Plus 的表单校验规则；
- 项目关闭了 zod 的 JIT 优化（`jitless: true`），因为内容安全策略和"禁止 eval"的规则不允许动态生成函数。对使用没有影响。
