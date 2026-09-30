# 实体与数据库

**实体**是一个 TypeScript 类，用来描述一张表的结构。项目使用 TypeORM，数据库是 MySQL。

## 基本写法

```ts
// book.entity.ts
import { Column, Entity } from 'typeorm'
import { BaseEntity, decimalNumber } from '../../../../core/db/base.entity.js'
import { DataScoped } from '../../../../core/data-scope/data-scope.js'

@DataScoped({ dept: 'dept_id', owner: 'created_by' })       // 数据范围（可选）
@Entity('demo_book')                                         // 表名
export class Book extends BaseEntity {
  /** ISBN */
  @Column({ length: 20 })
  isbn: string

  /** 出版日期 */
  @Column({ name: 'published_on', type: 'date', nullable: true })
  publishedOn: string | null

  /** 定价（元） */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: decimalNumber })
  price: number

  /** 所属部门 ID */
  @Column({ name: 'dept_id', type: 'bigint', unsigned: true, nullable: true })
  deptId: number | null

  /** 是否启用 */
  @Column({ type: 'boolean', default: true })
  enabled: boolean
}
```

- **列名用 `name` 显式指定**：数据库里是下划线 `published_on`，代码里是驼峰 `publishedOn`。项目没有配置自动转换，所以名字不同时一定要写 `name`；
- 实体只是"描述"表结构，**不会自动建表或改表**（`synchronize` 永远是关闭的）。表结构只通过[迁移](#迁移)修改。

## 基类

| 基类 | 包含的列 | 用在哪里 |
| --- | --- | --- |
| `BaseEntity` | `id`、`deleted_at`、`created_by`、`created_at`、`updated_by`、`updated_at` | **一般的业务表都用它** |
| `CreatedEntity` | `id`、`deleted_at`、`created_at` | 只追加、不修改的表（比如日志） |
| `IdEntity` | `id`、`deleted_at` | 最简单的表 |

- `created_by`、`updated_by` 由 `AuditSubscriber` 从当前登录用户**自动填写**，而且会**覆盖**客户端传来的值，防止伪造；定时任务、命令行脚本中没有登录用户，这两列为空；
- `deleted_at` 用于逻辑删除，查询时 TypeORM 会自动排除已删除的行。

## 列类型对照

| MySQL | 实体写法 | TS 类型 | 说明 |
| --- | --- | --- | --- |
| `bigint unsigned` | `@Column({ type: 'bigint', unsigned: true })` | `number` | id、引用其他表的 id。已配置为返回数字 |
| `varchar(64)` | `@Column({ length: 64 })` | `string` | 可以为空时要写 `type: 'varchar'` |
| `varchar` 可空 | `@Column({ type: 'varchar', length: 500, nullable: true })` | `string \| null` | |
| `text` | `@Column({ type: 'text' })` | `string` | |
| `int` | `@Column({ type: 'int', default: 0 })` | `number` | |
| `decimal(10,2)` | `@Column({ type: 'decimal', precision: 10, scale: 2, transformer: decimalNumber })` | `number` | 不加 `decimalNumber` 会得到字符串 |
| `tinyint(1)` | `@Column({ type: 'boolean', default: true })` | `boolean` | |
| `date` | `@Column({ type: 'date' })` | `string` | 格式 `YYYY-MM-DD`，**不是 Date** |
| `datetime(3)` | `@Column({ type: 'datetime', precision: 3 })` | `Date` | 存 UTC 时间 |
| `json` | `@Column({ type: 'json', nullable: true })` | 对象类型 | |

::: warning 数字精度
`decimalNumber` 把小数转成 JS 的 `number`，最多约 15 位有效数字。金额在这个范围内没有问题；更高精度的数值，不要加 `decimalNumber`，保留字符串。
:::

### 敏感列

密码哈希这类不能返回给前端的列，加上 `select: false`，默认查询时不会读出来：

```ts
@Column({ name: 'password_hash', length: 100, select: false })
passwordHash: string
```

## 只读关联

用户表里存的是 `dept_id`，列表要显示部门名称。在实体上声明一个**只读**的关联：

```ts
// user.entity.ts
/** 只用于联表读取部门名称（已删除的部门会联出 null） */
@ManyToOne(() => Dept, { createForeignKeyConstraints: false })
@JoinColumn({ name: 'dept_id' })
dept?: Relation<Dept> | null
```

- `createForeignKeyConstraints: false`：项目不使用数据库外键；
- 只用来查询：`this.scopedQb('t').leftJoinAndSelect('t.dept', 'd')`；
- 修改时仍然只改 `deptId` 这一列。

## 引用关系

项目**不使用数据库外键**，引用关系在应用层声明和检查：

```ts
import { referencedBy } from '../../../../core/db/references.js'

// 岗位被 iam_user_positions.position_id 引用：还有用户在用这个岗位时，不能删除
referencedBy('iam_position', { table: 'iam_user_positions', column: 'position_id' })

// 发票被明细引用：删除发票时，明细一起删除
referencedBy('demo_invoice', { table: 'demo_invoice_line', column: 'invoice_id', cascade: true })
```

`referencedBy(被引用的表, { table, column, cascade? })`，写在实体文件或者模块文件的**顶层**（不在类里面）。

| | 效果 |
| --- | --- |
| 默认（限制） | 还有未删除的行引用它时，删除返回 **409**"数据正在被使用" |
| `cascade: true`（级联） | 删除时，引用它的行在同一个事务中一起逻辑删除 |

另外，新增或修改时，如果引用的 id 指向不存在或已删除的行，返回 **404**。

引用平台表的情况（比如业务表的 `dept_id` 引用部门），在 `biz.module.ts` 中声明：

```ts
// biz.module.ts
referencedBy('iam_dept', { table: 'demo_book', column: 'dept_id' })
```

代码生成器配置页的"引用"一栏，可以直接配置这些关系。

## 数据范围

```ts
@DataScoped({ dept: 'dept_id', owner: 'created_by' })
```

- `dept`：按哪一列判断部门，没有部门维度时写 `null`；
- `owner`：按哪一列判断"本人"，没有时写 `null`；
- 两个值都是**数据库列名**，不是属性名。

详见[权限与数据范围](/features/permission#数据范围)。

## 迁移

表结构的每一次修改，都写成一个迁移文件。

### 文件

```text
apps/server/src/db/migrations/20261002100000-crm-customer.ts
                               └── 时间戳 ──┘ └ 说明 ┘
```

```ts
import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CrmCustomer20261002100000 implements MigrationInterface {
  name = 'CrmCustomer20261002100000'          // 和类名一致，末尾是时间戳

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE crm_customer ( … )`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE crm_customer')
  }
}
```

### 建表约定

```sql
CREATE TABLE crm_customer (
  id bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '客户 ID',
  code varchar(32) NOT NULL COMMENT '客户编码',
  name varchar(128) NOT NULL COMMENT '客户名称',
  dept_id bigint unsigned NULL COMMENT '所属部门 ID',
  created_by bigint unsigned NULL COMMENT '创建人 ID',
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_by bigint unsigned NULL COMMENT '更新人 ID',
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at datetime(3) NULL COMMENT '删除时间',
  alive tinyint AS (IF(deleted_at IS NULL, 1, NULL)) VIRTUAL COMMENT '未删除为 1',
  PRIMARY KEY (id),
  UNIQUE KEY uk_crm_customer_code (code, alive),
  KEY idx_crm_customer_dept (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='客户'
```

| 约定 | 原因 |
| --- | --- |
| `id bigint unsigned AUTO_INCREMENT` | 统一的主键 |
| 时间用 `datetime(3)`，存 UTC | 精确到毫秒；不受服务器时区影响 |
| 有 `deleted_at` | 逻辑删除 |
| 唯一索引带 `alive` | 删除后，这个值可以被重新使用 |
| 引用其他表的列只加普通索引，**不加外键** | 用 `referencedBy` 在应用层检查 |
| 每一列都写 `COMMENT` | 代码生成器用它作为字段名称 |
| `utf8mb4` | 支持中文和表情符号 |

各条约定的强制程度，见[新增业务模块](/guide/new-module#_1-用迁移建表)。

### 执行和回退

```bash
pnpm db:migrate                  # 执行所有还没执行的迁移
pnpm db:migrate -- revert        # 回退最后一个迁移（执行它的 down）
pnpm db:migrate -- show          # 查看哪些迁移执行过了
```

- 迁移从编译后的 `dist/db/migrations/*.js` 执行，`db:migrate` 会先自动编译；
- 已经执行过的迁移记录在 `meta_migrations` 表中；
- 每个迁移在单独的事务中执行。但要注意，MySQL 的建表、改表语句会**自动提交**，执行到一半失败时无法完全回滚，可能需要手动处理。

::: danger 已经提交的迁移不要修改
其他人或者其他环境可能已经执行过它，修改后不会再次执行。需要再改表结构，就写一个新的迁移。
:::

## 连接配置

数据库连接在 `apps/server/src/db/data-source.ts` 中统一配置，一般不需要修改：

- 会话时区设为 UTC（`SET time_zone = '+00:00'`）；
- 大整数返回数字（`bigNumberStrings: false`）；
- `synchronize: false`：永远不自动同步表结构；
- 迁移记录表：`meta_migrations`。
