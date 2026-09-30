# 新增业务模块

以一个 CRM 项目的"客户"（`crm_customer` 表）为例，从建菜单分组、建表，到在页面上看到它，完整走一遍。

```text
① 在菜单管理中建分组  →  ② 用迁移建表  →  ③ 导入表并配置  →  ④ 生成代码
      →  ⑤ 粘贴注册代码  →  ⑥ 执行种子  →  ⑦ 给角色授权
```

## 表名决定了什么

生成器**只根据表名**推导模块的名字，不需要任何配置文件：

| 表名 | 领域 | 业务名 | 说明 |
| --- | --- | --- | --- |
| `crm_customer` | `crm` | `customer` | **第一段是领域，其余是业务名** |
| `erp_sale_order` | `erp` | `sale-order` | 业务名多个单词时用短横线连接 |
| `biz_course` | `biz` | `course` | `biz_` 前缀归入内置的"业务管理" |
| `course` | `biz` | `course` | 没有下划线的表，也归入 `biz` |
| `demo_book` | `demo` | `book` | 示例模块 |

由领域和业务名，得到模块的全部名字（以 `erp_sale_order` 为例）：

| 用途 | 规则 | 例子 |
| --- | --- | --- |
| 后端目录 | `modules/<领域>/<业务名>/` | `modules/erp/sale-order/` |
| 前端页面 | `views/<领域>/<业务名>/` | `views/erp/sale-order/index.vue` |
| 前端接口 | `api/<领域>/<业务名>.ts` | `api/erp/sale-order.ts` |
| 共享规则 | `packages/shared/src/<领域>/<业务名>.schema.ts` | `erp/sale-order.schema.ts` |
| 接口地址 | `/api/<领域>/<业务名的复数>` | `/api/erp/sale-orders` |
| 权限点 | `<领域>.<驼峰业务名>.<动作>` | `erp.saleOrder.browse` |
| 菜单名称 | `menu.<领域>.<驼峰业务名>` | `menu.erp.saleOrder` |

有几个细节：

- 平台用到的名字是**保留名**（比如 `iam`、`system`、`auth`、`password`），不能用作领域。保留名的完整列表在 `packages/shared/src/common/reserved-names.ts`，第一段是保留名的表会归入 `biz`；
- 两个领域有同名的业务（比如 `erp_customer` 和 `crm_customer`）时，类名会自动加上领域前缀（`ErpCustomer`）。

## ① 在菜单管理中建分组

生成的页面要挂在一个菜单分组下面。CRM 需要一个自己的分组：

1. 打开 **系统管理 → 菜单管理**，点"新增"；
2. 类型选"**分组**"，名称填"客户关系"，路由地址填 `/crm`；
3. **路由名**会自动填成 `crm`。路由名只能是小写字母、数字和短横线，**保存后不能修改**，因为种子和生成的页面都靠它找到这个分组；
4. 保存。

分组可以有多层。比如在 `/erp` 下面再建一个"销售管理"，路由地址 `/erp/sale`，路由名会自动填成 `erp-sale`。

::: tip 不需要分组的情况
`biz_` 开头的表和没有下划线的表，默认挂在内置的"**业务管理**"分组下，不需要自己建分组。
:::

## ② 用迁移建表

表结构只通过迁移修改。在 `apps/server/src/db/migrations/` 下新建一个文件，文件名以时间戳开头：

```ts
// apps/server/src/db/migrations/20261002100000-crm-customer.ts
import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CrmCustomer20261002100000 implements MigrationInterface {
  name = 'CrmCustomer20261002100000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE crm_customer (
      id bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '客户 ID',
      code varchar(32) NOT NULL COMMENT '客户编码',
      name varchar(128) NOT NULL COMMENT '客户名称',
      level varchar(16) NOT NULL COMMENT '等级（字典 crm.customer_level）',
      dept_id bigint unsigned NULL COMMENT '所属部门 ID（数据权限）',
      enabled tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
      created_by bigint unsigned NULL COMMENT '创建人 ID',
      created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
      updated_by bigint unsigned NULL COMMENT '更新人 ID',
      updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
      deleted_at datetime(3) NULL COMMENT '删除时间',
      alive tinyint AS (IF(deleted_at IS NULL, 1, NULL)) VIRTUAL COMMENT '未删除为 1',
      PRIMARY KEY (id),
      UNIQUE KEY uk_crm_customer_code (code, alive),
      KEY idx_crm_customer_dept (dept_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户'`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE crm_customer')
  }
}
```

建表约定：

- **逻辑删除**：必须有 `deleted_at` 列。删除操作只写入删除时间，数据仍然保留在库里；
- **唯一索引带上 `alive`**：`alive` 是一个生成列，未删除时为 1，删除后为空。这样记录删除之后，它的编码可以重新使用；
- **不建外键**：引用其他表的列只加普通索引，"被引用则不允许删除"由生成器配置 `referencedBy` 来实现；
- **列注释就是字段名**：生成器会把注释用作表单标签和中文翻译；
- **有 `dept_id` 列**时，生成的代码会自动接入数据范围。

| 约定 | 是否强制 | 违反了会怎样 |
| --- | --- | --- |
| `deleted_at` 列 | **生成器拒绝** | 导入、预览、生成、写入都返回 422（错误码 `C3010`），提示需要加的列定义；一批导入中只要有一张表缺这一列，整批都不导入 |
| 唯一索引带 `alive` | 只提示 | 能运行，但删除后的编码不能再被使用 |
| 不建外键 | 测试检查 | 迁移测试断言库里没有外键，`pnpm ci:local` 不通过 |
| 零手改模块（有 `.cg.ts` 配置） | 硬性检查 | 缺 `deleted_at` 或 `alive` 时，`pnpm db:seed` 直接报错 |

执行迁移：

```bash
pnpm db:migrate
```

## ③ 导入表并配置

打开 **系统工具 → 代码生成**，点"**导入表**"，勾选 `crm_customer`，点"导入选中"。缺少 `deleted_at` 列的表会显示为灰色，不能勾选，并说明原因。

也可以用命令行导入：

```bash
pnpm gen import crm_customer
```

导入后，点这一行的"编辑"，可以调整：

- **基本信息**：领域 `crm`、业务名 `customer`（已经从表名推导好了）、模板（单表 / 树表 / 主子表）；
- **字段**：每一列是否出现在列表、查询条件、表单里，用什么控件（文本框、下拉框、字典、部门树、选择用户、上传……）；
- **生成信息**：
  - **父菜单**：默认按表名逐段匹配已有的分组。`crm_customer` 会匹配到刚才建的 `crm`；`erp_sale_order` 会先找 `erp-sale`，找不到再找 `erp`，都没有时挂在"业务管理"下。可以在这里改选任意层级的分组；
  - 是否需要导出、导入、下拉接口、详情抽屉，表单分几列；
  - 被哪些表引用（`referencedBy`）；
- **双语文本**：界面上显示的中英文。

## ④ 生成代码

**预览或下载**：在页面上预览每个文件，或者下载 zip 包。

**直接写入仓库**（推荐，只在本机开发环境可用）：

```bash
# 先在 apps/server/.env 中设置 CODEGEN_WRITE=true，然后重启 pnpm dev
pnpm gen write crm_customer
```

写入是安全的：

- 只会写到 `apps/*/src`、`packages/shared/src` 和 `apps/server/test` 下面；
- **从不覆盖已经存在的文件**。如果文件已存在且内容不同，会打印差异，并且一个文件都不写；
- 要么全部写入，要么全部不写。

一个模块会生成：实体、服务、控制器、zod 规则和权限常量、菜单和权限种子、e2e 测试、列表页、表单弹框、详情抽屉、中英文翻译。

## ⑤ 粘贴注册代码

生成器不修改已有的文件，所以最后会打印需要手动添加的代码（预览页面顶部也会显示）。以 `crm_customer` 为例：

```text
register crm_customer by hand (the generator edits no existing file):
  apps/server/src/modules/project.module.ts:
    import { CustomerModule } from './crm/customer/customer.module.js'  + CustomerModule in `imports`
  apps/server/src/db/seeds/index.ts:
    import { seedCustomer } from '../../modules/crm/customer/customer.seed.js'  + seedCustomer in SEEDS.project
  packages/shared/src/index.ts:
    export * from './crm/customer.schema.js'
  apps/server/src/db/seeds/project/menu-groups.seed.ts, in PROJECT_MENU_GROUPS (the groups not there yet, parents first):
    { routeName: "crm", parent: null, name: "客户关系", nameI18n: { "zh-CN": "客户关系", "en-US": "CRM" }, routePath: "/crm", icon: null, sortNo: 10 },
```

一共 4 处：

**1. 后端模块**：`apps/server/src/modules/project.module.ts`

```ts
import { CustomerModule } from './crm/customer/customer.module.js'

@Module({
  imports: [BookModule, TopicModule, InvoiceModule, DemoRealtimeModule, LeaveModule, CustomerModule],
})
export class ProjectModule {}
```

**2. 种子**：`apps/server/src/db/seeds/index.ts`

```ts
import { seedCustomer } from '../../modules/crm/customer/customer.seed.js'

const SEEDS: Record<string, Seed[]> = {
  // …
  project: [seedProjectMenuGroups, seedCustomer],     // 加在 seedProjectMenuGroups 后面
}
```

**3. 共享包导出**：`packages/shared/src/index.ts`

```ts
export * from './crm/customer.schema.js'
```

**4. 菜单分组**：`apps/server/src/db/seeds/project/menu-groups.seed.ts`

```ts
export const PROJECT_MENU_GROUPS: ProjectMenuGroup[] = [
  { routeName: 'crm', parent: null, name: '客户关系', nameI18n: { 'zh-CN': '客户关系', 'en-US': 'CRM' }, routePath: '/crm', icon: null, sortNo: 10 },
]
```

::: tip 为什么要把分组写进种子
第 ① 步在菜单管理中建的分组，只存在于**你自己的数据库**里。把它写进这个文件，同事的电脑、测试服务器、生产环境执行种子时，才会得到同样的分组。已经有的分组只需要写一次，生成器打印时会列出父分组链上的所有分组，**只加文件里还没有的**。挂在内置分组（比如"业务管理"）下的模块，不需要这一步。
:::

前端不需要注册：路由来自后端下发的菜单，翻译文件会被自动加载。

## ⑥ 执行种子

```bash
pnpm db:seed
```

`SEEDS.project` 最后执行：先建分组（只插入不存在的），再建各模块的页面和按钮权限。

几个规则：

- 分组被管理员**删除**了：这个模块的菜单会被跳过，并打印提示，其他种子照常执行；
- 分组**不存在**（没有写进 `menu-groups.seed.ts`）：种子报错，并提示去这个文件里添加；
- 生成的页面的**父菜单、图标、排序只在第一次插入时写入**。管理员在菜单管理中移动了页面、换了图标，重新执行种子不会改回去。

## ⑦ 给角色授权

**生成的页面不会自动授权给任何角色**，只有超级管理员能马上看到。在 **系统管理 → 角色管理** 中，点角色的 **更多 → 菜单权限**，勾选新页面和按钮。生成的权限点是：

```text
crm.customer.browse   列表
crm.customer.view     详情
crm.customer.create   新增
crm.customer.modify   修改
crm.customer.remove   删除
crm.customer.export   导出
crm.customer.import   导入
```

刷新页面，侧边栏的"客户关系"分组下就出现了"客户"。

## 在生成的代码上继续开发

生成器只负责标准的增删改查部分。更复杂的需求直接在生成的文件里手写，比如关联查询、服务端计算的字段、自定义操作、脱敏显示、多对多关系。参见：

- [手把手：加一个自定义操作](/backend/tutorial)
- [开发指南](/core/)：控制器、服务、查询等每一层的完整写法

::: tip
如果一个模块需要保持"零手改"（模板更新后可以重新生成、没有任何差异），就把额外的逻辑写在相邻的新文件里，不要改动生成的文件。
:::

## 检查

```bash
pnpm --filter @qiwu/server test crm-customer.e2e   # 这个模块的 e2e 测试
pnpm verify                                        # lint、类型检查、翻译完整性、许可证等
```
