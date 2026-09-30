# 模块结构与注册

项目里的每个功能都是一个**模块**。一个模块的代码分散在后端、共享包、前端三个地方，但**文件结构是固定的**：代码生成器生成的模块、手写的模块、平台自带的模块，都是同一套结构。认识了一个模块，就认识了所有模块。

## 一个模块由哪些文件组成

以"图书"示例模块（`demo_book` 表）为例，它的全部文件：

```text
apps/server/src/
├─ db/migrations/20260927130100-demo-book.ts         迁移：建表
└─ modules/biz/demo/book/
   ├─ book.entity.ts                                 实体：表结构
   ├─ book.service.ts                                服务：业务逻辑
   ├─ book.controller.ts                             控制器：接口
   ├─ book.module.ts                                 模块：把上面三个组装起来
   └─ book.seed.ts                                   种子：菜单和按钮权限

apps/server/test/e2e/
├─ demo-book.e2e-spec.ts                             生成的标准测试
└─ demo-book-extra.e2e-spec.ts                       手写的补充测试

packages/shared/src/
├─ biz/demo/book.schema.ts                           zod 规则、类型、权限常量
└─ i18n/{zh-CN,en-US}/modules/demo.book.json         字段名翻译（前后端共用）

apps/web/src/
├─ api/biz/demo/book.ts                              接口封装
├─ views/biz/demo/book/
│  ├─ index.vue                                      列表页
│  ├─ form.vue                                       新增、编辑表单
│  └─ detail.vue                                     详情抽屉
└─ locales/{zh-CN,en-US}/demo.book.json              页面文字和菜单名翻译
```

## 三个名字

每个模块由三个名字决定，它们都来自**表名**：

| 名字 | 图书示例 | 从哪里来 | 决定了什么 |
| --- | --- | --- | --- |
| 分组 group | `biz` | 表名前缀 | 代码放在 `modules/biz/` 还是 `modules/platform/` 下 |
| 领域 domain | `demo` | 表名前缀 | 接口路径 `/api/demo/…`、权限点 `demo.*`、目录 `biz/demo/` |
| 业务名 business | `book` | 表名去掉前缀 | 文件名 `book.*.ts`、类名 `Book*`、接口 `/api/demo/books` |

表名前缀和它们的对应关系：

| 表名前缀 | 分组 | 领域 | 说明 |
| --- | --- | --- | --- |
| `biz_` | `biz` | `biz` | 项目业务的默认前缀 |
| `demo_` | `biz` | `demo` | 示例 |
| `iam_` | `platform` | `iam` | 用户、角色、菜单、部门、岗位 |
| `cfg_` | `platform` | `settings` | 字典、参数 |
| `msg_` | `platform` | `messaging` | 消息 |
| `aud_` | `platform` | `audit` | 日志 |
| `fs_` | `platform` | `storage` | 文件 |
| `job_` | `platform` | `scheduler` | 定时任务 |
| `wf_` | `workflow` | `wf` | 工作流 |

没有登记的前缀（比如 `crm_`），会按"没有前缀"处理：分组和领域都是 `biz`，业务名是整个表名。见下一节。

## 分组和领域：做 CRM 还要叫 biz 吗？

**不用。** 这里的 `biz` 容易混淆，它其实指两个不同的东西：

| | 是什么 | 能不能改 |
| --- | --- | --- |
| **分组** `biz` | 代码放在哪一层的目录：`modules/biz/`、`views/biz/`，意思是"项目自己的业务代码"，和平台代码分开 | **固定**。不管做 CRM 还是 ERP，业务代码都在这个分组下 |
| **领域** domain | 业务名称，决定接口路径和权限点 | **由你决定**：做 CRM 就叫 `crm`，做 ERP 就叫 `erp` |

以客户表为例，建议的写法是：

| | 推荐 |
| --- | --- |
| 表名 | `crm_customer` |
| 分组 | `biz` |
| 领域 | `crm` |
| 业务名 | `customer` |
| 目录 | `modules/biz/crm/customer/`、`views/biz/crm/customer/` |
| 接口 | `/api/crm/customers` |
| 权限点 | `crm.customer.browse`、`crm.customer.create`…… |

**目前的操作方法**：代码生成器还不认识 `crm_` 前缀，导入后默认会得到领域 `biz`、业务名 `crm-customer`。在生成配置的"**基本信息**"页签里，把**领域**改成 `crm`、**业务名**改成 `customer`，再生成即可。

::: tip 以后会更方便
计划支持项目登记自己的前缀（比如 `crm_ → crm`），导入时自动得到正确的领域和菜单分组，不用每张表手动修改。
:::

## 分层：谁能依赖谁

```text
core（框架层）  ←  platform（平台模块）  ←  workflow（工作流）  ←  biz（你的业务）
```

箭头表示"可以依赖"：`biz` 可以使用所有层，`platform` 不能依赖 `workflow` 和 `biz`，`core` 不能依赖任何模块。

这条规则由 lint 检查强制执行，违反时 `pnpm verify` 会失败。好处是：**你的业务代码只放在 `modules/biz` 和 `views/biz` 里，以后升级模板时，平台部分的改动和你的代码几乎不会冲突。**

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
// customer.module.ts：先导出
@Module({
  // …
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}

// order.module.ts：再导入
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

新模块写好（或生成好）之后，要在 **3 个地方**注册。代码生成器在预览和写入时，会打印出需要添加的具体代码。

### ① 后端模块

`apps/server/src/modules/biz/biz.module.ts` 是所有业务模块唯一的注册入口：

```ts
import { CustomerModule } from './biz/customer/customer.module.js'

@Module({
  imports: [BookModule, TopicModule, InvoiceModule, DemoRealtimeModule, LeaveModule, CustomerModule],
})
export class BizModule {}
```

**忘了这一步，接口会返回 404。**

### ② 种子

`apps/server/src/db/seeds/index.ts`，把模块的种子函数加进 `SEEDS`：

```ts
import { seedCustomer } from '../../modules/biz/biz/customer/customer.seed.js'

const SEEDS: Record<string, Seed[]> = {
  // …
  biz: [seedCustomer],
}
```

**忘了这一步，菜单和权限不会出现。** 详见[种子与菜单](/core/seed)。

### ③ 共享包导出

`packages/shared/src/index.ts`：

```ts
export * from './biz/biz/customer.schema.js'
```

**忘了这一步，后端和前端都 import 不到这个模块的规则和类型。**

### 注册之后

```bash
pnpm db:migrate      # 如果有新的迁移
pnpm db:seed         # 写入菜单和权限
```

然后在 **系统管理 → 角色管理** 中给角色授权，刷新页面即可看到新菜单。

## 从零开始新建一个模块

完整步骤见[新增业务模块](/guide/new-module)。概括来说：

1. 写迁移建表（遵守[建表约定](/guide/new-module#_1-用迁移建表)），执行 `pnpm db:migrate`；
2. 在 **系统工具 → 代码生成** 中导入表、调整配置；
3. 写入工作区（或者 `pnpm gen write <表名>`）；
4. 按上面的方法注册；
5. `pnpm db:seed`，给角色授权；
6. 在生成的代码上继续写业务逻辑。
