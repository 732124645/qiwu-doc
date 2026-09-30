# TypeScript 速成

TypeScript 的语法和 Java 很接近，这一页**只讲和 Java 不一样的地方**。

## 最重要的一点：类型在运行时不存在

TypeScript 编译成 JavaScript 之后，**所有类型信息都会被删除**。

```ts
interface CreateUser {
  username: string
  age: number
}

@Post()
create(@Body() dto: CreateUser) {
  // 编译器认为 dto.age 是 number，
  // 但运行时 dto 就是前端发来的 JSON，age 完全可能是 "abc"，也可能根本不存在
}
```

在 Java 里，Jackson 反序列化时会按类型转换，类型不对就直接报错。**TypeScript 不会做这件事。** 所以从外部进来的数据（请求参数、Excel、第三方接口的返回值）**必须用运行时校验**。本项目用的是 zod：

```ts
// packages/shared：定义一次
export const userCreate = z.object({
  username: z.string().trim().min(1).max(64),
  age: z.number().int().min(0),
})
export type UserCreate = z.infer<typeof userCreate>     // 从规则推导出类型，不用重复写一遍

// 控制器：校验不通过直接返回 400，通过后 dto 的类型才是可信的
create(@Body({ schema: userCreate }) dto: UserCreate) { … }
```

**先有 zod 规则，再从规则推导出类型**，这是本项目的标准写法。

## 结构类型

Java 是"名义类型"：一个类必须显式 `implements` 某个接口，才算是这个接口的实现。

TypeScript 是"**结构类型**"：只要形状对得上，就认为类型兼容。

```ts
interface Named { name: string }

const p = { name: '开发', code: 'dev' }
const n: Named = p            // ✅ 可以：p 有 name 属性，形状匹配
```

所以 TypeScript 里很少需要"为了实现接口而写一个类"，直接用普通对象就行。

## interface、type 和 class

| | 用途 | 运行时存在吗 |
| --- | --- | --- |
| `interface` / `type` | 描述数据的形状 | 不存在 |
| `class` | 需要实例和方法，或者需要装饰器（控制器、服务、实体） | 存在 |

数据对象（DTO、VO）一般用 zod 推导出来的 `type`，不需要写成类。**只有 NestJS 需要管理的东西才写成类**。

## null 和 undefined

JavaScript 有两个"空值"：

- `undefined`：没有赋值、属性不存在；
- `null`：显式地设为"空"。

项目的约定是：

- **数据库中可以为空的列**用 `null`，类型写作 `string | null`；
- **可选参数和可选属性**用 `undefined`，写作 `name?: string`。

项目开启了严格模式，编译器会强制你处理空值：

```ts
const row = await this.repo.findOneBy({ id })    // 类型是 Position | null
row.name                                          // ❌ 编译错误：row 可能是 null
row?.name                                         // ✅ 可选链：row 为 null 时返回 undefined
row!.name                                         // 断言不为空（确定不为空时才用）
const name = row?.name ?? '默认'                   // ?? 空值合并：左边是 null 或 undefined 时取右边
```

::: warning 注意 `||` 和 `??` 的区别
`0 || 10` 的结果是 `10`，因为 `0` 被当成了"假"；`0 ?? 10` 的结果是 `0`。给数字设置默认值时要用 `??`。
:::

## 相等比较

一律用 `===` 和 `!==`。`==` 会做隐式类型转换（`'1' == 1` 为 `true`），不要使用。

和 Java 不同，JavaScript 没有 `equals()`：`===` 比较对象时比较的是**引用**，两个内容相同的对象也不相等。

## 枚举：用字符串字面量联合类型

项目不使用 TypeScript 的 `enum`，而是使用**字符串字面量的联合类型**：

```ts
// packages/shared/src/common/crud.ts
export const IMPORT_MODES = ['insert', 'upsert'] as const
export type ImportMode = (typeof IMPORT_MODES)[number]      // = 'insert' | 'upsert'

let mode: ImportMode = 'insert'   // ✅
mode = 'replace'                  // ❌ 编译错误

z.enum(IMPORT_MODES)              // 同一个数组还能直接用来做运行时校验
```

这样数据库里存的、接口里传的、代码里用的，都是同一个字符串，不需要来回转换。

## 模块和导入

- 一个文件就是一个模块，用 `export` 导出，用 `import` 导入，没有 `package` 声明；
- **相对路径导入必须写 `.js` 后缀**（即使源文件是 `.ts`），这是 Node.js ES 模块的要求：

  ```ts
  import { PositionService } from './position.service.js'
  ```

- 只导入类型时，写成 `import type { … }`。它在编译后会被删除。

::: danger 依赖注入的类型不能用 import type
NestJS 靠参数的类型来决定注入什么。如果把服务写成 `import type { PositionService }`，运行时类型信息就没了，启动时会报错说无法解析依赖。
:::

## 函数和集合

```ts
// 箭头函数 ≈ Java 的 lambda
const names = rows.map((r) => r.name)
const enabled = rows.filter((r) => r.enabled)
const total = rows.reduce((sum, r) => sum + r.price, 0)
const found = rows.find((r) => r.id === id)       // 找不到时返回 undefined

// 解构
const { code, name } = dto
const [first, ...rest] = list

// 展开：复制并修改对象（常用于"不修改原对象"）
const next = { ...dto, enabled: true }

// Map 和 Set 和 Java 的用法差不多
const byId = new Map(rows.map((r) => [r.id, r]))
const ids = [...new Set(list)]                     // 去重
```

JavaScript 的数组没有 Stream 的惰性求值，`map`、`filter` 每一步都会生成一个新数组。数据量不大时不用在意这一点。

## 日期

JavaScript 的 `Date` 远不如 `java.time` 好用。项目的约定是：

- 数据库存储 UTC 时间，接口返回 ISO 格式的字符串（`2026-09-27T08:00:00.000Z`）；
- 需要格式化或计算时，前后端都使用 **dayjs**。

## 装饰器 ≈ 注解

写法几乎一样，但注意：

- 装饰器**必须带括号**：`@Injectable()`，不能写成 `@Injectable`；
- 装饰器本质上是一个**在类定义时执行的函数**，而注解只是元数据。你平时写业务不需要自己定义装饰器。

## 严格模式和 lint

项目开启了 TypeScript 严格模式，并使用 oxlint 和 ESLint 检查代码。`pnpm verify` 会运行全部检查。IDE 推荐 VS Code，打开项目后会自动提示类型错误和 lint 问题。
