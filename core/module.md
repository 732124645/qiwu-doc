# 模块结构与注册

项目里的每个功能都是一个**模块**。一个模块的代码分散在后端、共享包、前端三个地方，但**文件结构是固定的**：代码生成器生成的模块、手写的模块、平台自带的模块，都是同一套结构。认识了一个模块，就认识了所有模块。

## 代码分成两部分

```text
apps/server/src/modules/
├─ platform/        模板自带：用户、角色、菜单、字典、日志、文件、定时任务……
├─ workflow/        模板自带：工作流
├─ biz/             项目业务：内置的"业务管理"领域（请假示例在这里）
├─ demo/            示例：图书、知识主题、发票、实时推送
├─ crm/             你的项目领域
├─ erp/             你的项目领域
└─ project.module.ts   所有项目领域的注册入口
```

- `platform/` 和 `workflow/` 是**模板代码**；
- 除此之外的每一个顶层目录（`biz/`、`demo/`、`crm/`……）都是**项目代码**，一个目录就是一个领域。

前端（`views/`、`api/`）和共享包（`packages/shared/src/`）也是同样的结构。

这样分开的好处是：**以后升级模板时，只会改动 `platform/` 和 `workflow/`，你的代码不会冲突。**

## 一个模块由哪些文件组成

以"图书"示例模块（`demo_book` 表）为例，它的全部文件：

```text
apps/server/src/
├─ db/migrations/20260927130100-demo-book.ts         迁移：建表
└─ modules/demo/book/
   ├─ book.entity.ts                                 实体：表结构
   ├─ book.service.ts                                服务：业务逻辑
   ├─ book.controller.ts                             控制器：接口
   ├─ book.module.ts                                 模块：把上面三个组装起来
   └─ book.seed.ts                                   种子：菜单和按钮权限

apps/server/test/e2e/
├─ demo-book.e2e-spec.ts                             生成的标准测试
└─ demo-book-extra.e2e-spec.ts                       手写的补充测试

packages/shared/src/
├─ demo/book.schema.ts                               zod 规则、类型、权限常量
└─ i18n/{zh-CN,en-US}/modules/demo.book.json         字段名翻译（前后端共用）

apps/web/src/
├─ api/demo/book.ts                                  接口封装
├─ views/demo/book/
│  ├─ index.vue                                      列表页
│  ├─ form.vue                                       新增、编辑表单
│  └─ detail.vue                                     详情抽屉
└─ locales/{zh-CN,en-US}/demo.book.json              页面文字和菜单名翻译
```

## 领域和业务名

每个项目模块由两个名字决定，它们都来自**表名**：

| 名字 | 图书示例 | 决定了什么 |
| --- | --- | --- |
| 领域 domain | `demo` | 顶层目录、接口路径 `/api/demo/…`、权限点 `demo.*` |
| 业务名 business | `book` | 文件名 `book.*.ts`、类名 `Book*`、接口 `/api/demo/books` |

推导规则：

| 表名 | 领域 | 业务名 | 说明 |
| --- | --- | --- | --- |
| `crm_customer` | `crm` | `customer` | 第一段是领域，其余是业务名 |
| `erp_sale_order` | `erp` | `sale-order` | 多个单词用短横线连接 |
| `biz_course` | `biz` | `course` | 内置的"业务管理"领域 |
| `course` | `biz` | `course` | 没有下划线的表归入 `biz` |
| `demo_book` | `demo` | `book` | 示例 |

平台表的前缀是固定的，对应到 `platform/` 或 `workflow/` 下：

| 表名前缀 | 位置 | 说明 |
| --- | --- | --- |
| `iam_` | `platform/iam/` | 用户、角色、菜单、部门、岗位 |
| `cfg_` | `platform/settings/` | 字典、参数 |
| `msg_` | `platform/messaging/` | 消息 |
| `aud_` | `platform/audit/` | 日志 |
| `fs_` | `platform/storage/` | 文件 |
| `job_` | `platform/scheduler/` | 定时任务 |
| `oauth_` | `platform/oauth/` | OAuth2 |
| `wf_` | `workflow/` | 工作流 |

**保留名**不能用作领域，比如 `iam`、`system`、`auth`、`password`。完整列表在 `packages/shared/src/common/reserved-names.ts`，第一段是保留名的表会归入 `biz`。

**名字的写法**：

| 用途 | 写法 | 例子（`erp_sale_order`） |
| --- | --- | --- |
| 目录、文件名、接口地址 | 短横线 | `sale-order/`、`/api/erp/sale-orders` |
| 权限点、翻译键、表格 id | 驼峰 | `erp.saleOrder.browse`、`menu.erp.saleOrder` |
| 类名 | 大驼峰 | `SaleOrder`、`SaleOrderService` |

两个领域有同名业务（比如 `erp_customer` 和 `crm_customer`）时，类名自动加上领域前缀：`ErpCustomer`。

## 分层：谁能依赖谁

```text
core（框架层）  ←  platform（平台）  ←  workflow（工作流）  ←  项目领域（biz、demo、crm……）
```

箭头表示"可以依赖"：

- 项目领域可以使用所有层，项目领域之间也可以互相使用；
- `platform` 和 `workflow` **不能**引用任何项目领域的目录；
- `core` 不能依赖任何模块。

这条规则由 lint 检查强制执行，违反时 `pnpm verify` 会失败。

## 模块文件

```ts
// book.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BookController } from './book.controller.js'
import { Book } from './book.entity.js'
import { BookService } from './book.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Book])],   // 这个模块用到的实体
  controllers: [BookController],                  // 这个模块的控制器
  providers: [BookService],                       // 这个模块的服务
})
export class BookModule {}
```

| 字段 | 说明 |
| --- | --- |
| `imports` | 依赖的其他模块，以及用到的实体（`TypeOrmModule.forFeature`） |
| `controllers` | 控制器，会注册成接口 |
| `providers` | 服务等可以被注入的类 |
| `exports` | 允许其他模块注入的服务。**不导出，别的模块就用不了** |

### 使用其他模块的服务

比如订单模块要用到客户服务：

```ts
// crm/customer/customer.module.ts：先导出
@Module({
  // …
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}

// erp/order/order.module.ts：再导入
@Module({
  imports: [TypeOrmModule.forFeature([Order]), CustomerModule],
  // …
})
export class OrderModule {}

// order.service.ts：然后就能注入了
constructor(private readonly customers: CustomerService) { … }
```

`core` 里的很多服务是**全局提供**的，不需要导入模块就能直接注入，比如 `DictService`、`ParamService`、`Notifier`、`RealtimeService`、`REDIS`、`ExcelService`。

## 注册一个新模块

新模块写好（或生成好）之后，要在 **4 个地方**注册。代码生成器在预览和写入时，会打印出需要添加的具体代码。

### ① 后端模块

`apps/server/src/modules/project.module.ts` 是所有项目模块唯一的注册入口：

```ts
import { CustomerModule } from './crm/customer/customer.module.js'

@Module({
  imports: [BookModule, TopicModule, InvoiceModule, DemoRealtimeModule, LeaveModule, CustomerModule],
})
export class ProjectModule {}
```

**忘了这一步，接口会返回 404。**

### ② 种子

`apps/server/src/db/seeds/index.ts`，把模块的种子函数加进 `SEEDS.project` 的最后：

```ts
import { seedCustomer } from '../../modules/crm/customer/customer.seed.js'

const SEEDS: Record<string, Seed[]> = {
  // …
  project: [seedProjectMenuGroups, seedProjectActionVerbs, seedCustomer],
}
```

**忘了这一步，菜单和权限不会出现。**

### ③ 菜单分组

模块挂在项目自己的菜单分组下（比如 `crm`）时，把分组写进 `apps/server/src/db/seeds/project/menu-groups.seed.ts`，这样其他环境执行种子时也会创建它。挂在内置分组（比如"业务管理"）下时，不需要这一步。详见[种子与菜单](/core/seed#项目的菜单分组)。

### ④ 共享包导出

`packages/shared/src/index.ts`：

```ts
export * from './crm/customer.schema.js'
```

**忘了这一步，后端和前端都 import 不到这个模块的规则和类型。**

### 另外：手写接口的新动作名

代码生成器生成的接口只用平台已有的动作名（新增、修改、删除、导入、导出）。如果你手写的接口在 `@ActionLog` 中用了新的动作名（比如 `upgrade`），还要登记到项目文件 `apps/server/src/db/seeds/project/action-verbs.seed.ts`，详见[控制器](/core/controller#一个完整的例子)。

前端**不需要**注册：路由来自后端下发的菜单，页面文件和翻译文件都会被自动找到。

### 注册之后

```bash
pnpm db:migrate      # 如果有新的迁移
pnpm db:seed         # 写入菜单分组、页面和按钮权限
```

然后在 **系统管理 → 角色管理** 中给角色授权（生成的页面不会自动授权），刷新页面即可看到新菜单。

## 从零开始新建一个模块

完整步骤见[新增业务模块](/guide/new-module)。
