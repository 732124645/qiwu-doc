# 新增业务模块

以"客户"（`biz_customer`）为例，从建表到在页面上看到它，完整走一遍。

## 1. 用迁移建表

表结构只通过迁移修改，项目从不自动同步表结构。在 `apps/server/src/db/migrations/` 下新建一个文件，文件名以时间戳开头：

```ts
// apps/server/src/db/migrations/20261001100000-biz-customer.ts
import type { MigrationInterface, QueryRunner } from 'typeorm'

export class BizCustomer20261001100000 implements MigrationInterface {
  name = 'BizCustomer20261001100000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE biz_customer (
      id bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '客户 ID',
      code varchar(32) NOT NULL COMMENT '客户编码',
      name varchar(128) NOT NULL COMMENT '客户名称',
      level varchar(16) NOT NULL COMMENT '等级（字典 biz.customer_level）',
      dept_id bigint unsigned NULL COMMENT '所属部门 ID（数据权限）',
      enabled tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
      created_by bigint unsigned NULL COMMENT '创建人 ID',
      created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
      updated_by bigint unsigned NULL COMMENT '更新人 ID',
      updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
      deleted_at datetime(3) NULL COMMENT '删除时间',
      alive tinyint AS (IF(deleted_at IS NULL, 1, NULL)) VIRTUAL COMMENT '未删除为 1',
      PRIMARY KEY (id),
      UNIQUE KEY uk_biz_customer_code (code, alive),
      KEY idx_biz_customer_dept (dept_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户'`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE biz_customer')
  }
}
```

建表约定（生成器依赖这些约定，强制程度见下面的表格）：

- **表名前缀决定所属域**：前缀决定接口路径、权限点和菜单的默认位置。目前代码生成器只认识 `biz_` 等几个内置前缀；用自己的前缀（比如 `crm_`、`erp_`）也可以，只要在代码生成的"基本信息"里把**领域**改成 `crm`、**业务名**改成去掉前缀的部分，详见[分组和领域](/core/module#分组和领域-做-crm-还要叫-biz-吗)。
- **逻辑删除**：必须有 `deleted_at` 列。删除操作只写入删除时间，数据仍然保留在库里。
- **唯一索引带上 `alive`**：`alive` 是一个生成列，未删除时为 1，删除后为空。这样记录删除之后，它的编码可以重新使用。
- **不建外键**：引用其他表的列只加普通索引，删除时的"被引用则不允许删除"由生成器配置 `referencedBy` 来实现。
- **列注释就是字段名**：生成器会把注释用作表单标签和中文翻译。
- **有 `dept_id` 列**时，生成的代码会自动接入数据范围。

| 约定 | 是否强制 | 违反了会怎样 |
| --- | --- | --- |
| 表名前缀 | 不强制 | 只用来推导接口路径、权限点和菜单位置；没有前缀时按 `biz` 处理 |
| `deleted_at` 列 | 运行时出错 | 导入时只提示，但生成的代码按逻辑删除查询，缺这一列会报"找不到列" |
| 唯一索引带 `alive` | 只提示 | 能运行，但删除后的编码不能再被使用 |
| 不建外键 | 测试检查 | 迁移测试断言库里没有外键，`pnpm ci:local` 不通过 |
| 零手改模块（有 `.cg.ts` 配置） | 硬性检查 | 缺 `deleted_at` 或 `alive` 时，`pnpm db:seed` 直接报错 |

执行迁移：

```bash
pnpm db:migrate
```

## 2. 导入表并配置

打开 **系统工具 → 代码生成**，点"导入"并选择 `biz_customer`，然后在编辑页调整配置：

- 每一列：是否出现在列表、查询条件、表单里，用什么控件（输入框、下拉、字典、部门树、用户选择、上传……）
- 模板：单表 / 树表 / 主子表
- 是否需要导入导出、详情抽屉，表单分几列
- 被哪些表引用（`referencedBy`）
- **父菜单**：生成的页面挂在哪个菜单分组下面

::: warning 目前请手动选择父菜单
`biz_` 开头的表默认挂在 `biz` 分组下，但当前版本的种子数据**还没有创建这个分组**，执行 `pnpm db:seed` 时会报错 `the biz menu group is missing`。在修复之前，请在"生成信息"页签的"父菜单"中选择一个已有的分组（比如"生成示例"）。
:::

也可以用命令行导入：

```bash
pnpm gen import biz_customer
```

## 3. 生成代码

**预览或下载**：在页面上预览每个文件，或者下载 zip 包。

**直接写入仓库**（推荐，只在本机开发环境可用）：

```bash
# apps/server/.env 中设置 CODEGEN_WRITE=true
pnpm gen write biz_customer
```

写入是安全的：

- 只会写到 `apps/*/src`、`packages/shared/src` 和 `apps/server/test` 下面；
- **从不覆盖已经存在的文件**。如果文件已存在且内容不同，会打印差异，并且一个文件都不写；
- 要么全部写入，要么全部不写。

一个模块会生成这些内容：实体、服务、控制器、zod 规则和权限常量、菜单和权限种子、e2e 测试、列表页、表单弹框、详情抽屉、中英文翻译。

## 4. 手动注册

生成结束时，命令会打印需要手动添加的几行代码，一般有三处：

1. `apps/server/src/modules/biz/biz.module.ts`：在 `imports` 里加上 `CustomerModule`
2. 种子入口：加上这个模块的菜单种子
3. `packages/shared` 的导出：加上 `customer.schema.ts`

然后重新执行种子，把菜单和权限写进库里：

```bash
pnpm db:seed
```

## 5. 分配权限

用 `admin` 登录后，在 **系统管理 → 角色** 中给需要的角色勾选新菜单和按钮权限。生成的权限点是：

```text
biz.customer.browse   列表
biz.customer.view     详情
biz.customer.create   新增
biz.customer.modify   修改
biz.customer.remove   删除
biz.customer.export   导出
biz.customer.import   导入
```

刷新页面，新菜单就会出现。

## 6. 在生成的代码上继续开发

生成器只负责标准的增删改查部分。更复杂的需求直接在生成的文件里手写，比如关联查询、服务端计算的字段、自定义动作、脱敏显示、多对多关系等。

::: tip
如果一个模块需要保持"零手改"（模板更新后可以重新生成、没有任何差异），就把额外的逻辑写在相邻的新文件里，不要改动生成的文件。
:::

## 检查

```bash
pnpm --filter @qiwu/server test biz-customer.e2e   # 这个模块的 e2e 测试
pnpm verify                                        # lint、类型检查、翻译完整性、许可证等
```
