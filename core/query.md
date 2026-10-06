---
description: '后端查询的三种方式：带数据范围的 scopedQb 和 QueryBuilder、参数化条件、pageQuery 分页排序、联表和子查询、原生 SQL 的规则、行锁和性能建议。'
---

# 查询

项目中查询数据有三种方式，按推荐程度排列：

| 方式 | 适用场景 |
| --- | --- |
| `scopedQb()` + QueryBuilder | **大部分情况**：列表、详情、下拉选项、联表查询。自动带上数据范围和逻辑删除条件 |
| `this.repo.find…()` | 在事务中按主键读取已经确认过范围的数据（比如 `lockScopedIds` 之后） |
| `this.txHost.tx.query(sql, params)` | 复杂的统计、报表 |

## QueryBuilder 基础

```ts
const rows = await this.scopedQb('t')                     // FROM demo_book t  +  数据范围  +  deleted_at IS NULL
  .select(['t.id', 't.title'])                            // 只取需要的列
  .andWhere('t.enabled = :enabled', { enabled: true })    // 条件，值用命名参数
  .andWhere('t.price >= :min', { min: 10 })
  .orderBy('t.sortNo')                                    // 排序（用属性名）
  .addOrderBy('t.id', 'DESC')
  .take(50)                                               // 最多 50 条
  .getMany()
```

### 结果方法

| 方法 | 返回 |
| --- | --- |
| `getMany()` | 实体数组 |
| `getOne()` | 一个实体，或 `null` |
| `getCount()` | 数量 |
| `getManyAndCount()` | `[实体数组, 总数]` |
| `getRawMany()` / `getRawOne()` | 原始的行（联表、统计时使用，字段名就是 `select` 里写的别名） |

### 条件的写法

```ts
qb.andWhere('t.code = :code', { code })                              // 等于
qb.andWhere('t.name LIKE :name', { name: contains(name) })           // 包含
qb.andWhere('t.id IN (:...ids)', { ids })                            // 在列表中（注意 :...）
qb.andWhere('t.price BETWEEN :min AND :max', { min, max })           // 范围
qb.andWhere('(t.username LIKE :kw OR t.display_name LIKE :kw)', { kw: contains(keyword) })   // 或
qb.andWhere('t.dept_id IS NULL')                                     // 为空
```

::: danger 值一定要用参数
```ts
qb.andWhere(`t.code = '${code}'`)          // ❌ SQL 注入！pnpm verify 会报错
qb.andWhere('t.code = :code', { code })    // ✅
```
确实需要拼接（比如列名来自代码中的白名单，而不是用户输入），在旁边写上 `// arch-allow: sql-concat <原因>`，架构检查才会放行。必须写明原因。
:::

::: warning 只用 andWhere
`scopedQb()` 已经加上了数据范围条件，再调用 `.where()` 会**把它替换掉**。所以只能用 `andWhere`、`orWhere` 要放在括号里。
:::

## 分页和排序

### 分页参数

列表接口的查询规则都基于 `pageQuery`（共享包 `common/pagination.ts`）：

```ts
export const bookQuery = pageQuery(['sortNo', 'title', 'price', 'createdAt', 'id'])   // 允许排序的字段
  .extend({
    title: z.string().trim().max(200).optional(),
    enabled: z.stringbool().optional(),
  })
```

| 参数 | 规则 |
| --- | --- |
| `page` | 从 1 开始，默认 1 |
| `pageSize` | 1 到 200，默认 20 |
| `sort` | 比如 `createdAt,-id`（`-` 表示倒序）。**只能使用白名单中的字段**，否则返回 400 |

### 分页函数

`BaseCrudService.page()` 内部调用的是 `paginate()`，自己写查询时也可以用：

```ts
import { contains, paginate } from '../../../../core/db/page.js'

const { items, total } = await paginate(this.filter(this.withDept(), query), query)
```

`paginate` 会：按 `sort` 排序，最后总是加上 `id DESC` 保证顺序稳定，然后分页并统计总数。

### 联表字段排序

排序字段不在主表上时（比如按部门名称排序），传一个字段到列的映射：

```ts
paginate(qb, query, { deptName: 'd.name' })
```

## 范围查询

日期、数字的范围，约定用 `<字段>From` 和 `<字段>To` 两个参数：

```ts
// 规则
publishedOnFrom: z.iso.date().optional(),
publishedOnTo: z.iso.date().optional(),

// 服务
if (publishedOnFrom) qb.andWhere('t.publishedOn >= :from', { from: publishedOnFrom })
if (publishedOnTo) qb.andWhere('t.publishedOn <= :to', { to: publishedOnTo })
```

前端的日期范围查询条件，命名为 `publishedOnRange`（值是 `[开始, 结束]`），`useCrudList` 会自动转换成这两个参数。

## 联表查询

### 通过实体上的关联

```ts
this.scopedQb('t').leftJoinAndSelect('t.dept', 'd')    // 结果中每个用户带上 dept 对象
```

### 没有声明关联时

```ts
// inbox.service.ts：把收件人映射到 t.recipient 上
qb.leftJoinAndMapOne('t.recipient', User, 'recipient', 'recipient.id = t.userId AND recipient.deletedAt IS NULL')
```

### 联表取部分字段

```ts
// bulletin-receipt.service.ts：已读用户列表
const qb = this.scopedQb('t')
  .innerJoin('msg_bulletin_receipt', 'r',
    'r.user_id = t.id AND r.bulletin_id = :id AND r.deleted_at IS NULL', { id })
  .leftJoin('t.dept', 'd')
  .select([
    't.id AS userId',
    't.username AS username',
    'd.name AS deptName',
    'r.read_at AS readAt',
  ])

const total = await qb.getCount()
const rows = await sorted(qb, query.sort ?? [{ field: 'readAt', order: 'DESC' }], { readAt: 'r.read_at' })
  .offset((query.page - 1) * query.pageSize)
  .limit(query.pageSize)
  .getRawMany<ReceiptRow>()
```

- 用表名联表（`innerJoin('msg_bulletin_receipt', …)`）时，**要自己加上 `deleted_at IS NULL`**；
- 用 `getRawMany` 时，分页要用 `offset` / `limit`，不要用 `skip` / `take`。

### 子查询

```ts
// 部门及其所有下级部门中的用户
qb.andWhere(
  `t.dept_id IN (SELECT d.id FROM iam_dept d, iam_dept f
                  WHERE f.id = :deptId AND d.tree_path LIKE CONCAT(f.tree_path, '%')
                    AND d.deleted_at IS NULL)`,
  { deptId },
)
```

## 原生 SQL

统计、报表这类复杂查询，直接写 SQL：

```ts
const [{ n }] = await this.txHost.tx.query<{ n: string }[]>(
  `SELECT COUNT(*) AS n
     FROM msg_bulletin b
    WHERE b.published = 1 AND b.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM msg_bulletin_receipt r
                       WHERE r.bulletin_id = b.id AND r.user_id = ? AND r.deleted_at IS NULL)`,
  [userId],
)
return Number(n)
```

| 规则 | 说明 |
| --- | --- |
| 参数用 `?` | 按顺序传入数组 |
| 每张表都加 `deleted_at IS NULL` | 架构检查会逐表确认。确实需要包含已删除数据时（比如显示已删除用户的名字），在那一行或上一行写注释 `qw:include-deleted` |
| 不会自动加数据范围 | 需要时自己处理 |
| 数字结果用 `Number()` 转换 | `COUNT(*)` 等可能返回字符串 |
| 使用 `this.txHost.tx` | 这样才会加入当前的事务 |

## 锁

| 写法 | 作用 |
| --- | --- |
| `lockScopedIds(ids)` | 锁定要修改的行，同时检查数据范围。**按 id 修改时首选** |
| `.setLock('pessimistic_write')` | QueryBuilder 加 `FOR UPDATE` |
| SQL 末尾加 `FOR SHARE` | 共享锁：读取时防止被别人删除（检查引用时常用） |

锁只在事务中有效，所以都要放在 `withTransaction` 里面。

## 性能提示

- 经常作为查询条件的列要加**索引**（在迁移中添加）；
- 列表只 `select` 需要的列，特别是有大文本列时；
- 不要在循环中逐条查询（N+1 问题），用 `IN (:...ids)` 一次查出来；
- 导出大量数据时使用 `exportRows()`，它会分批读取。
