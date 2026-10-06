---
description: '后端服务层写法：继承 BaseCrudService 并覆写 filter 和增删改方法，按 id 修改时加锁、事务与提交后的操作、树形数据、主子表、多对多关系和原生 SQL。'
---

# 服务

服务是**业务逻辑所在的地方**：查询数据、检查业务规则、修改数据、调用其他服务。控制器只负责接收请求，然后把工作交给服务。

## 基类 BaseCrudService

所有标准的增删改查服务都继承自 `BaseCrudService`（`core/db/base-crud.service.ts`），常用的方法都已经实现好了：

```ts
@Injectable()
export class PositionService extends BaseCrudService<Position> {
  constructor(txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    super(txHost, Position)          // 传入事务管理器和实体
  }
}
```

### 方法一览

| 方法 | 说明 |
| --- | --- |
| `page(query, columns?)` | 分页列表。先经过数据范围，再经过 `filter()`，然后排序和分页 |
| `exportRows(query, columns?)` | 导出用：条件和排序与列表相同，每批 1000 行，不分页 |
| `get(id)` | 查一条。不存在或者超出数据范围时，抛出 404 |
| `create(dto)` | 新增。会忽略 dto 中的 `id`，检查数据范围和引用关系，在事务中执行 |
| `update(id, dto)` | 修改。先锁定这一行，只修改 dto 中有值的字段（`undefined` 的字段不动） |
| `remove(ids)` | 逻辑删除。任何一个 id 超出范围返回 404；仍被引用返回 409；全部成功或全部失败 |
| `scopedQb(alias)` | 得到一个**已经加上数据范围条件**的查询构造器。所有读取都应该从它开始 |
| `lockScopedIds(ids)` | 在事务中锁定这些行（`SELECT … FOR UPDATE`），并确认都在数据范围内，否则 404 |
| `assertUnique(field, value, excludeId?)` | 检查唯一性，重复时返回 409 |
| `assertWritableScope(row)` | 检查一行数据写入后，是否仍在当前用户的数据范围内 |
| `repo`（受保护） | 当前事务中的 TypeORM Repository |
| `filter(qb, query)`（受保护） | **子类覆写它来添加列表的查询条件** |

## 添加查询条件：覆写 filter

`page()` 和 `exportRows()` 都会调用 `filter()`，所以列表和导出的条件永远一致：

```ts
protected override filter(qb: SelectQueryBuilder<Position>, { code, name, enabled }: PositionQuery) {
  if (code) qb.andWhere('t.code LIKE :code', { code: contains(code) })
  if (name) qb.andWhere('t.name LIKE :name', { name: contains(name) })
  if (enabled !== undefined) qb.andWhere('t.enabled = :enabled', { enabled })
  return qb
}
```

- 表的别名固定是 `t`；
- **只能用 `andWhere`**。用 `where` 会覆盖掉已经加上的数据范围条件；
- `contains(text)` 会转义 `%` 和 `_`，然后在前后加上 `%`。用户搜索 `50%` 时，不会被当成通配符。

更多查询写法见[查询](/core/query)。

## 在新增、修改、删除时加逻辑：覆写方法

### 修改数据后再保存

公告服务在保存之前，清洗富文本内容：

```ts
// bulletin.service.ts
override create(dto: DeepPartial<Bulletin>): Promise<Bulletin> {
  return super.create(cleanBody(dto))
}

override update(id: number, dto: QueryDeepPartialEntity<Bulletin>): Promise<void> {
  return super.update(id, cleanBody(dto))
}
```

### 增加检查条件

```ts
override async create(dto: DeepPartial<Course>): Promise<Course> {
  if ((dto.credit ?? 0) > 10) throw new BizError(Err.BIZ_COURSE_CREDIT_TOO_HIGH, { max: 10 })
  return super.create(dto)
}
```

### 删除时做额外的事

公告服务删除已发布的公告时，要通知在线的用户。注意**通知要在事务提交之后发送**：

```ts
// bulletin.service.ts
override async remove(ids: readonly number[]): Promise<void> {
  const live = await this.txHost.withTransaction(async () => {
    await this.lockScopedIds(ids)
    const rows = await this.repo.find({
      select: { id: true },
      where: { id: In([...ids]), published: true },
    })
    await super.remove(ids)
    return rows.map((r) => r.id)
  })
  if (live.length) this.push('deleted', live)      // 事务已经提交，再推送
}
```

## 按 id 修改的标准写法

自己写的、按 id 修改数据的方法，都应该是这个结构：

```ts
upgrade(id: number): Promise<void> {
  return this.txHost.withTransaction(async () => {
    await this.lockScopedIds([id])                                   // ① 锁定，并检查数据范围
    const row = await this.repo.findOneByOrFail({ id })              // ② 读出最新的数据
    if (!row.enabled) throw new BizError(Err.CRM_CUSTOMER_DISABLED)  // ③ 检查业务规则
    await this.repo.update(id, { level: 'vip' })                     // ④ 修改
  })
}
```

::: warning 为什么一定要这样写
- 不调用 `lockScopedIds`：用户改一下请求里的 id，就能修改别人部门的数据；
- 不加锁：两个人同时操作时，第二个人的检查可能基于旧数据，从而违反业务规则；
- 不在事务里：`lockScopedIds` 会直接报错（锁只在事务中有效）。

对带数据范围的实体，架构检查会确认带 `:id` 的修改接口经过了 `lockScopedIds`。
:::

## 事务

```ts
return this.txHost.withTransaction(async () => {
  // 这里面的所有数据库操作，要么全部成功，要么全部回滚
})
```

- `withTransaction` 可以**嵌套**：内层会加入外层的事务，不会新开一个；
- 事务中调用其他服务的方法，也会自动加入同一个事务（通过 CLS 传递，不需要传参数）；
- 抛出任何异常都会回滚；
- 项目里统一使用 `withTransaction`，没有使用 `@Transactional()` 装饰器。

### 提交之后才能做的事

有些事情必须等事务**提交之后**才能做，否则可能基于回滚了的数据：

- 推送实时消息；
- 让用户的会话失效（`SessionRevoker`）、刷新权限版本（`PermVersion`）；
- 删除缓存。

用户服务的做法是：事务返回"之后要做什么"，外面再执行：

```ts
// user.service.ts（简化）
interface After { bump?: boolean; revoke?: string }

async modify(id: number, body: unknown) {
  await this.after(
    this.txHost.withTransaction(async (): Promise<After> => {
      // …修改数据…
      return { bump: rolesChanged, revoke: disabling ? 'user_disabled' : undefined }
    }),
    id,
  )
}

protected async after(write: Promise<After>, id: number) {
  const { bump, revoke } = await write              // 等事务提交
  if (revoke) await this.revoker.revokeUser(id, revoke)
  else if (bump) await this.permVersion.bumpUser(id)
}
```

[消息通知](/core/notify) `notifier.send()` 已经自动处理了这个问题，在事务里调用即可，它会等提交之后再发送。

## 调用其他模块的服务

对方模块在 `exports` 里导出服务，你的模块在 `imports` 里导入对方模块，然后就能在构造函数中注入。项目里的例子：用户模块使用部门服务。

```ts
// dept.module.ts
@Module({ /* … */ exports: [DeptService] })
export class DeptModule {}

// user.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User]), DeptModule, RoleModule, SmsOtpModule],
  // …
})
export class UserModule {}

// user.service.ts
constructor(
  txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  private readonly depts: DeptService,
  // …
) { super(txHost, User) }

// 使用：部门的查询同样带着当前用户的数据范围
const qb = this.depts.scopedQb('d')
```

`core` 中的这些服务是全局提供的，直接注入即可，不需要导入模块：`DictService`、`ParamService`、`ExcelService`、`Notifier`、`RealtimeService`、`REDIS`。

## 关联查询

需要显示其他表的字段（比如用户列表显示部门名称）时，写一个带 join 的查询方法：

```ts
// user.service.ts
/** scopedQb('t') 加上部门，用来显示部门名称 */
protected withDept(): SelectQueryBuilder<User> {
  return this.scopedQb('t').leftJoinAndSelect('t.dept', 'd')
}

async list(query: UserQuery) {
  const { items, total } = await paginate(this.filter(this.withDept(), query), query)
  return { items: this.toVos(items), total }
}
```

实体上要声明一个只读的关联，见[实体与数据库](/core/entity#只读关联)。

## 树形数据：BaseTreeService

部门、知识主题这类有上下级关系的数据，继承 `BaseTreeService`（`core/db/base-tree.service.ts`）。表需要有 `parent_id`、`tree_path` 列，可选 `enabled`、`sort_no`。

它在 `BaseCrudService` 的基础上提供：

| 方法 | 说明 |
| --- | --- |
| `list(query)` | 返回整棵树（不分页） |
| `create` / `update` | 自动维护 `tree_path`；移动节点时一起更新所有下级。`tree_path` 列最长 512 个字符，新增或移动后任何一个节点（包括已删除的下级）的路径会超长时，直接返回 422（`A0464`），什么都不写 |
| `remove` | 有下级时不能删除 |
| 启用规则 | 启用一个节点时，自动启用它的上级；有启用的下级时不能停用；上级停用时不能新增下级 |

可以覆写的钩子：

| 钩子 | 什么时候调用 |
| --- | --- |
| `beforeWrite(set, stored?)` | 新增、修改之前（在事务中） |
| `beforeRemove(ids)` | 删除之前（在事务中） |
| `afterMove(ids)` | 节点移动之后（事务提交之后） |

部门服务的例子：删除部门前，检查部门下是否还有用户：

```ts
// dept.service.ts（简化）
protected override async beforeRemove(ids: number[]) {
  const [{ n }] = await this.txHost.tx.query(
    'SELECT COUNT(*) AS n FROM iam_user WHERE dept_id IN (?) AND deleted_at IS NULL FOR SHARE',
    [ids],
  )
  if (Number(n)) throw new BizError(Err.IAM_DEPT_HAS_USERS)
}
```

## 主子表

一张单据带多行明细（比如发票和发票明细），由主表的服务在同一个事务中保存明细。发票示例：

```ts
// invoice.service.ts
override create({ lines, ...dto }: InvoiceCreate) {
  return this.txHost.withTransaction(async () => {
    const { id } = await super.create(dto)     // 先保存主表
    await this.saveLines(id, lines)            // 再保存明细
    return this.detail(id)
  })
}

override update(id: number, { lines, ...dto }: InvoiceUpdate) {
  return this.txHost.withTransaction(async () => {
    await super.update(id, dto)                // 先锁定并更新主表
    if (lines) await this.saveLines(id, lines)
  })
}
```

`saveLines` 的逻辑是：提交上来的明细里，**有 id 的更新，没有 id 的新增，数据库里有但没有提交上来的删除**。删除主表时，明细会跟着一起逻辑删除（由实体上的 `referencedBy(..., { cascade: true })` 声明，见[实体与数据库](/core/entity#引用关系)）。

代码生成器的"主子表"模板会生成这些代码。

## 多对多关系

用户和角色这种多对多关系，使用中间表和 `core/db/links.ts` 中的函数：

```ts
import { replaceLinks } from '../../../../core/db/links.js'
import { USER_ROLES } from '../iam-links.js'   // { table: 'iam_user_roles', owner: 'user_id', target: 'role_id' }

await replaceLinks(this.txHost.tx, USER_ROLES, userId, roleIds)
```

| 函数 | 说明 |
| --- | --- |
| `replaceLinks(q, link, ownerId, targetIds)` | 替换成这组 id：多的删除，少的添加 |
| `addLinks(q, link, ownerId, targetIds)` | 添加 |
| `removeLinks(q, link, ownerId, targetIds)` | 删除 |

中间表的一条记录永远只有一行：删除时逻辑删除，再次添加时恢复它。

## 原生 SQL

复杂的统计、报表查询，可以直接写 SQL：

```ts
const rows = await this.txHost.tx.query<{ id: number; name: string }[]>(
  `SELECT r.id, r.name
     FROM iam_user_roles ur
     JOIN iam_role r ON r.id = ur.role_id AND r.deleted_at IS NULL
    WHERE ur.user_id = ? AND ur.deleted_at IS NULL
    ORDER BY r.sort_no, r.id`,
  [userId],
)
return rows.map((r) => ({ id: Number(r.id), name: r.name }))
```

- 参数用 `?` 占位，**不能拼接字符串**；
- 每张表都要自己加上 `deleted_at IS NULL`，架构检查会确认这一点；
- 原生 SQL **不会**自动加上数据范围条件，需要时自己处理，或者使用 `scopedQb`；
- 数字类型的结果，最好用 `Number(...)` 转换一下。

## 抛出错误

```ts
throw new NotFoundException()                          // 404
throw new BizError(Err.DUPLICATE, { code })            // 409，带翻译好的信息
throw new BizError(Err.CRM_CUSTOMER_DISABLED)           // 自定义错误码
```

详见[异常处理](/core/errors)。
