# 数据库基础

对前端开发者来说，数据库是后端最陌生的部分。但它也是最重要的部分：**代码写错了可以改，数据写坏了往往就救不回来了。**

项目使用 **MySQL 8.4 及以上**。

## 表、行、列

可以把一张表想象成一个 Excel 工作表：

| id | code | name | sort_no | enabled | created_at | deleted_at |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | dev | 开发 | 10 | 1 | 2026-09-27 08:00:00 | NULL |
| 2 | qa | 测试 | 20 | 1 | 2026-09-27 08:00:00 | NULL |
| 3 | pm | 产品 | 30 | 0 | 2026-09-27 08:00:00 | 2026-09-28 10:00:00 |

- **表**（table）：`iam_position`，存放一类数据；
- **行**（row）：一条记录，也就是一个岗位；
- **列**（column）：一个字段。和 Excel 不同的是，**每一列的类型都是固定的**。

和前端的 JSON 相比，最大的区别是：**数据库的结构是严格的**。你不能随手往某一行里多塞一个字段，要加字段必须先修改表结构。

### 常用的列类型

| MySQL 类型 | 用途 | 对应的 TS 类型 |
| --- | --- | --- |
| `bigint unsigned` | id | `number` |
| `varchar(64)` | 短文本，最多 64 个字符 | `string` |
| `text` | 长文本 | `string` |
| `int` | 整数 | `number` |
| `decimal(10,2)` | 金额（精确的小数） | `number` |
| `tinyint(1)` | 布尔值（0 或 1） | `boolean` |
| `date` | 日期 | `string` |
| `datetime(3)` | 时间（精确到毫秒） | `Date` |
| `json` | JSON | `object` |

::: warning 金额不要用 float
`float` 和 `double` 是近似值，`0.1 + 0.2` 在数据库里也会出现精度问题。金额一律用 `decimal`。
:::

### NULL 和空字符串

`NULL` 表示"**没有值**"，和空字符串 `''` 不是一回事。比如备注字段：`NULL` 是"没填"，`''` 是"填了空内容"。定义列时要想清楚这一列允不允许为 `NULL`。

## SQL：和数据库说话的语言

后端通过 SQL 读写数据。你不需要精通，但至少要能看懂这四种语句：

```sql
-- 查询
SELECT id, code, name FROM iam_position WHERE enabled = 1 ORDER BY sort_no LIMIT 20;

-- 新增
INSERT INTO iam_position (code, name) VALUES ('ops', '运维');

-- 修改（一定要带 WHERE！）
UPDATE iam_position SET name = '运维工程师' WHERE id = 4;

-- 删除（一定要带 WHERE！）
DELETE FROM iam_position WHERE id = 4;
```

::: danger
`UPDATE` 或 `DELETE` 忘了写 `WHERE`，会修改或删除**整张表**的数据。在数据库客户端里手动执行这类语句之前，一定要再检查一遍。
:::

平时在项目里基本不用手写 SQL，而是用 **TypeORM** 生成。但调试时你会经常在日志里看到 SQL，所以要能看懂。

## 实体 Entity：表在代码里的样子

**实体**是一个 TypeScript 类，它描述了一张表的结构：

```ts
// position.entity.ts
@Entity('iam_position')                          // 对应的表名
export class Position extends BaseEntity {       // 继承 id、创建人、创建时间等通用列
  @Column({ length: 64 })
  code: string

  @Column({ name: 'sort_no', type: 'int', default: 0 })   // 数据库里叫 sort_no，代码里叫 sortNo
  sortNo: number

  @Column({ type: 'boolean', default: true })
  enabled: boolean

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null
}
```

`BaseEntity` 提供了每张表都有的列：

| 列 | 说明 |
| --- | --- |
| `id` | 主键，自动递增 |
| `created_by` / `created_at` | 谁、什么时候创建的（自动填写） |
| `updated_by` / `updated_at` | 谁、什么时候最后修改的（自动填写） |
| `deleted_at` | 删除时间，未删除为 `NULL` |

`created_by` 和 `updated_by` 是项目自动从当前登录用户中取出并填写的，你不需要手动设置。

## QueryBuilder：用代码拼 SQL

```ts
const rows = await this.scopedQb('t')          // FROM iam_position t（已经带上数据范围条件）
  .select(['t.id', 't.name'])                  // SELECT t.id, t.name
  .andWhere('t.enabled = :enabled', { enabled: true })   // WHERE t.enabled = ?
  .orderBy('t.sortNo')                         // ORDER BY t.sort_no
  .getMany()                                   // 执行查询，返回实体数组
```

常用的结尾方法：

| 方法 | 返回 |
| --- | --- |
| `getMany()` | 实体数组 |
| `getOne()` | 一个实体或 `null` |
| `getCount()` | 数量 |
| `getRawMany()` | 原始的行数据（用于统计、联表查询） |

::: warning 要用 andWhere，不要用 where
`scopedQb()` 已经加上了数据范围条件。如果你再调用 `.where(...)`，会**把前面的条件替换掉**，数据范围就失效了。所以只能用 `andWhere`。
:::

### SQL 注入

这是后端最经典的安全漏洞，一定要理解：

```ts
// ❌ 危险：把用户输入直接拼进 SQL
qb.andWhere(`t.code = '${code}'`)
```

如果用户在搜索框里输入 `' OR '1'='1`，拼出来的 SQL 就变成了：

```sql
WHERE t.code = '' OR '1'='1'      -- 永远为真，查出所有数据
```

更恶意的输入甚至能删除数据。正确的写法是使用**参数**：

```ts
// ✅ 安全：值作为参数单独传给数据库
qb.andWhere('t.code = :code', { code })
```

使用参数时，数据库会把 `code` 始终当作一个**值**，而不会当作 SQL 语句的一部分。项目里有检查脚本，发现字符串拼接 SQL 会直接报错。

## 索引：让查询变快

没有索引时，数据库要**一行一行地找**。表里有一百万行，就要看一百万行。

索引就像书的目录：按某一列事先排好序，查找时可以直接跳到对应的位置。

```sql
KEY idx_crm_customer_dept (dept_id)                 -- 普通索引：加快查询
UNIQUE KEY uk_crm_customer_code (code, alive)       -- 唯一索引：加快查询，并且不允许重复
```

什么时候要加索引：

- 经常出现在 `WHERE` 中的列（比如 `dept_id`、`user_id`、`status`）；
- 需要唯一的列（比如编码、用户名）。

索引也不是越多越好：每次写入数据时都要同时更新索引，所以很少查询的列不需要加。

## 事务：要么全成功，要么全失败

经典例子是转账：A 的账户减 100，B 的账户加 100。如果第一步成功了，第二步失败了，100 块钱就凭空消失了。

**事务**保证一组操作**要么全部成功，要么全部撤销**：

```ts
return this.txHost.withTransaction(async () => {
  await this.repo.update(aId, { balance: () => 'balance - 100' })
  await this.repo.update(bId, { balance: () => 'balance + 100' })
  // 这里任何一行抛出异常，前面的修改都会被撤销（回滚）
})
```

项目里的 `create`、`update`、`remove` 已经自动在事务中执行。**你自己写的方法，只要修改了不止一行数据，就要放进 `withTransaction`。**

事务内调用的其他服务方法，会自动加入同一个事务，不需要手动传递。

### 锁：防止两个人同时修改

两个管理员同时编辑同一条记录，或者用户快速点了两次按钮，都可能导致数据出错。

`lockScopedIds(ids)` 会在事务中执行 `SELECT … FOR UPDATE`：**锁住这些行，其他事务要修改它们，必须等当前事务结束**。它同时检查这些记录是否都在数据范围内。

所以按 id 修改数据的标准写法是：

```ts
return this.txHost.withTransaction(async () => {
  await this.lockScopedIds([id])         // 1. 锁住，并确认在数据范围内（否则 404）
  const row = await this.repo.findOneByOrFail({ id })   // 2. 读出最新数据
  if (!row.enabled) throw new BizError(/* … */)         // 3. 检查业务规则
  await this.repo.update(id, { /* … */ })               // 4. 修改
})
```

## 迁移：表结构的版本管理

表结构的修改（建表、加列、加索引）**只能通过迁移完成**，不能手动在数据库里改。

为什么？因为你的同事、测试服务器、生产服务器，各自都有一个数据库。如果你在自己的库里手动加了一列，其他人的库里没有这一列，代码一部署就会出错。

迁移就是**把表结构的每一次修改都写成代码**，和源码一起提交到 git：

```ts
// apps/server/src/db/migrations/20261001100000-crm-customer-vip.ts
export class CrmCustomerVip20261001100000 implements MigrationInterface {
  name = 'CrmCustomerVip20261001100000'

  async up(q: QueryRunner): Promise<void> {       // 升级：执行修改
    await q.query(`ALTER TABLE crm_customer ADD COLUMN vip_since datetime(3) NULL COMMENT '成为 VIP 的时间'`)
  }

  async down(q: QueryRunner): Promise<void> {     // 回退：撤销修改
    await q.query('ALTER TABLE crm_customer DROP COLUMN vip_since')
  }
}
```

执行 `pnpm db:migrate` 时，程序会检查 `meta_migrations` 表，**只执行还没有执行过的迁移**。每个环境各自执行一遍，所有数据库的结构就保持一致了。

::: danger 已经提交的迁移不要再修改
其他环境可能已经执行过这个迁移，修改它不会再次生效。需要再改表结构，就写一个新的迁移。
:::

改完表结构之后，记得同时更新对应的实体类。

## 逻辑删除

项目中的删除都是**逻辑删除**：不真正删除数据，而是在 `deleted_at` 列写入删除时间。

- 查询时 TypeORM 会自动加上 `deleted_at IS NULL`，已删除的数据对页面不可见；
- 数据还在库里，误删可以恢复，也方便审计；
- 过期数据由定时任务按保留天数清理。

### `alive` 列是做什么的

逻辑删除带来一个问题：岗位编码 `dev` 被删除之后，数据还在表里。如果编码列上有唯一索引，就再也不能新建编码为 `dev` 的岗位了。

解决办法是加一个**生成列** `alive`：

```sql
alive tinyint AS (IF(deleted_at IS NULL, 1, NULL)) VIRTUAL,
UNIQUE KEY uk_code (code, alive)
```

- 未删除的行，`alive = 1`，所以两个未删除的 `dev` 会冲突；
- 已删除的行，`alive = NULL`。MySQL 的唯一索引允许多个 `NULL`，所以不会和新的 `dev` 冲突。

`alive` 只在表结构中定义，实体类里**不要**映射它。

## 为什么不用外键

外键是数据库自带的"引用检查"：比如用户表的 `dept_id` 必须是部门表中存在的 id。

项目没有使用外键，因为它和逻辑删除配合不了：部门被逻辑删除后，那一行其实还在，外键会认为它依然有效。所以改由应用层来检查：

- 在实体上声明"谁引用了我"：`referencedBy('iam_position', { table: 'iam_user_positions', column: 'position_id' })`；
- 删除岗位时，如果还有用户在使用它，返回 **409**，并提示"数据正在被使用"。

## 时间和时区

- 数据库**统一存储 UTC 时间**，也就是零时区的时间；
- 接口返回 `2026-09-27T08:00:00.000Z` 这种格式（末尾的 `Z` 表示 UTC）；
- 前端用 `dayjs` 转换成用户本地的时间显示。

这样无论服务器在哪里、用户在哪个时区，时间都不会出错。
