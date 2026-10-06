---
description: '服务端功能权限和数据范围的写法：权限点格式、@RequirePerm、在实体上声明数据范围、scopedQb 和 lockScopedIds、范围外一律返回 404 和防越权授予。'
---

# 在代码中使用权限与数据范围

权限分两层：**功能权限**（能不能调用这个接口）和**数据范围**（能读写哪些行）。这一页讲写代码时怎么用它们。功能上的说明（管理员在哪里配置、用户看到什么）见[权限与数据范围](/features/permission)。

两层都在**服务端**检查。前端隐藏按钮只是让界面更友好，不能代替服务端的检查。

## 权限点

**权限点**就是一个字符串，代表一项具体操作。格式是 `<域>.<资源>.<动作>`：

```text
demo.book.browse          图书列表
iam.user.reset-password   重置用户密码
erp.saleOrder.create      生成器为表 erp_sale_order 生成的"新增"
```

格式由共享包里的正则规定：

```ts
// packages/shared/src/common/auth.ts
export const PERM_CODE = /^[a-z][a-zA-Z0-9-]*\.[a-z][a-zA-Z0-9-]*\.[a-z][a-zA-Z0-9-]*$/
```

- 三段，每段以小写字母开头，后面可以是字母、数字和 `-`；
- 资源名是业务名，多个单词时用驼峰（生成器就是这样生成的）；
- 自定义动作用短横线连接，比如 `reset-password`、`assign-roles`；
- 不要写成 `a:b:c` 的形式：`pnpm verify` 中的原创性检查会拒绝这种字符串。菜单里不符合格式的权限点**不授予任何权限**。

常用动作：

| 动作 | 含义 | 菜单里显示为 |
| --- | --- | --- |
| `browse` | 列表 | 浏览 |
| `view` | 详情 | 查看 |
| `create` | 新增 | 新增 |
| `modify` | 修改 | 修改 |
| `remove` | 删除 | 删除 |
| `export` | 导出 | 导出 |
| `import` | 导入 | 导入 |

### 权限常量放在共享包

每个模块在自己的 schema 文件里导出一个 `xxxPerms` 对象，前端和后端引用同一份。项目里**没有**集中的权限常量文件：

```ts
// packages/shared/src/demo/book.schema.ts
export const bookPerms = {
  browse: 'demo.book.browse',
  view: 'demo.book.view',
  create: 'demo.book.create',
  modify: 'demo.book.modify',
  remove: 'demo.book.remove',
  export: 'demo.book.export',
  import: 'demo.book.import',
} as const
```

带短横线的动作，用方括号取值：

```ts
// packages/shared/src/platform/iam/user.schema.ts（节选）
export const userPerms = {
  browse: 'iam.user.browse',
  // …
  'reset-password': 'iam.user.reset-password',
  'assign-roles': 'iam.user.assign-roles',
} as const

// 使用
@RequirePerm(userPerms['reset-password'])
```

项目自己的模块放在 `packages/shared/src/<域>/` 下（比如 `packages/shared/src/biz/leave.schema.ts` 的 `leavePerms`），并在 `packages/shared/src/index.ts` 里导出。代码生成器会把这些都生成好。

## 保护接口

### 默认需要登录

登录检查是**全局**的：每个接口默认都要求登录，不需要写任何东西。确实要公开的接口（比如登录、验证码），加 `@Public()`。

### @RequirePerm

```ts
// apps/server/src/modules/demo/book/book.controller.ts（节选）
import { RequirePerm } from '../../../core/auth/decorators.js'

@Get()
@RequirePerm(bookPerms.browse)
page(@Query({ schema: bookQuery }) query: BookQuery) {
  return this.books.page(query)
}

@Put(':id')
@RequirePerm(bookPerms.modify)
@ActionLog({ domain: 'demo.book', verb: 'modify' })
update(@Param('id', ParseIntPipe) id: number, @Body({ schema: bookUpdate }) dto: BookUpdate) {
  return this.books.update(id, dto)
}
```

| 写法 | 含义 |
| --- | --- |
| `@RequirePerm(a)` | 需要权限 `a` |
| `@RequirePerm(a, b)` | 有 `a` **或** `b` 其中一个即可 |
| `@RequirePerm.all(a, b)` | `a` 和 `b` **都要有** |
| `@RequireRole('code')` | 需要某个角色。尽量不用：角色是管理员随时会改的，权限点才是代码里固定的 |
| 都不写 | 登录即可调用 |

- 不满足时返回 **403**；
- 超级管理员总是通过；
- 没有登录用户的调用（公开接口、第三方客户端凭证）永远不通过；
- `@RequirePerm()` 不传参数时，应用启动就会报错。

不写 `@RequirePerm` 的接口，任何登录用户都能调用。项目里的例子是给下拉框用的角色列表：

```ts
// apps/server/src/modules/platform/iam/role/role.controller.ts（节选）
/** Any signed-in user (role pickers of the user page); root only for root. */
@Get('options')
options() {
  return this.roles.options()
}
```

::: info 权限检查还决定了数据范围
`@RequirePerm` 检查通过后，会把"这次检查了哪些权限点"记在当前请求的上下文里。后面的[数据范围](#数据范围怎么算)就按这些权限点来算。所以**需要功能权限、又带数据范围的接口，一定要用 `@RequirePerm` 声明权限**；不写的话，范围会按用户所有已启用的角色合起来算（见下面的表格）。只有登录就能调用、只返回调用者自己范围内数据的下拉选项接口才故意不写，比如 `GET /api/iam/users/options`、`GET /api/iam/depts/tree`。
:::

装饰器的完整列表见[控制器 · 装饰器一览](/core/controller#装饰器一览)。

### 在服务里判断权限

有时一个接口里，某个参数需要额外的权限。比如实时推送示例：发给所有人需要在 `send` 之外再有 `broadcast`：

```ts
// apps/server/src/modules/demo/realtime/realtime.service.ts（节选）
import { clsGet } from '../../../core/context/cls.js'

async send(body: DemoRealtimeSendBody): Promise<DemoRealtimeSendVo> {
  const p = clsGet('principal')
  if (!p) throw new BizError(Err.UNAUTHENTICATED)
  const all = body.target === 'all'
  if (all && !p.root && !p.perms.includes(demoRealtimePerms.broadcast))
    throw new ForbiddenException()
  // …
}
```

`clsGet('principal')` 取到当前登录用户（`Principal`，在 `core/auth/principal.ts`）：

| 字段 | 说明 |
| --- | --- |
| `userId`、`deptId` | 用户 id、所在部门 id |
| `perms` | 所有已启用角色的权限点合在一起 |
| `roles` | 已启用的角色，每个带自己的 `code`、`dataScope`、`perms` |
| `root` | 是不是超级管理员 |

::: warning 判断超级管理员只看 root
超级管理员的 `perms` 是 `['*']`，但**判断时只用 `p.root`**，不要用 `perms.includes('*')`。菜单里写的 `*` 不会授予任何权限，只有内置的 `root` 角色才是超级管理员。
:::

## 菜单种子里的按钮权限

权限点要挂在菜单的"按钮"记录上，管理员才能在 **系统管理 → 角色管理** 里勾选它：

```ts
// apps/server/src/modules/platform/iam/role/role.seed.ts（节选）
const ACTIONS: [perms: string, name: string][] = [
  [rolePerms.browse, 'menu.action.browse'],
  [rolePerms.view, 'menu.action.view'],
  // …
  [rolePerms.grant, 'menu.action.grant'],
]

for (const [i, [perms, name]] of ACTIONS.entries())
  await upsert(q, 'iam_menu', { kind: 'action', perms }, { parent_id: pageId, name, sort_no: (i + 1) * 10 })
```

- 种子按 `perms` 查找按钮，所以一个权限点只写一条按钮记录；
- 自定义动作的按钮名称，要在前端 `menu.json` 的 `menu.action` 下加翻译；
- 只能从某个隐藏页面进入的操作（比如"分配用户"），把按钮挂在这个隐藏页面下面，授予按钮的同时也就授予了页面。

完整的写法见[种子与菜单 · 菜单和按钮权限](/core/seed#菜单和按钮权限)和[隐藏页面](/core/seed#隐藏页面)。

::: tip 新模块不会自动授权
种子只创建菜单和按钮，不授予任何角色。生成新模块后，只有超级管理员能马上看到，其他角色要由管理员去授权。
:::

## 数据范围

### 在实体上声明

```ts
// apps/server/src/modules/demo/book/book.entity.ts（节选）
import { DataScoped } from '../../../core/data-scope/data-scope.js'

@Entity('demo_book')
@DataScoped({ dept: 'dept_id', owner: 'created_by' })
export class Book extends BaseEntity {
  // …
}
```

- `dept`：按哪一列判断部门；`owner`：按哪一列判断"本人"；
- 写的是**数据库列名**，不是属性名；没有这个维度时写 `null`；
- 代码生成器遇到有 `dept_id` 列的表，默认就会加上这个装饰器（生成选项"按部门做数据权限"）。

平台自己的实体是这样声明的：

| 表 | 声明 | "仅本人"的意思 |
| --- | --- | --- |
| `iam_user` | `{ dept: 'dept_id', owner: 'id' }` | 只看到自己这一行 |
| `iam_dept` | `{ dept: 'id', owner: null }` | 没有本人维度，什么都看不到 |
| `demo_book` | `{ dept: 'dept_id', owner: 'created_by' }` | 自己创建的图书 |

角色表 `iam_role` **没有**数据范围：角色不属于任何部门，谁能管角色只由 `iam.role.*` 权限决定，越权的风险由[防越权授予](#防越权授予)兜底。

### 数据范围怎么算

计算在 `apps/server/src/core/data-scope/data-scope.ts` 里，规则是：

1. **超级管理员**：不加条件；
2. **没有登录用户**（比如定时任务）：加 `1=0`，**什么都查不到**；
3. 其他人：先挑出"算数"的角色，再把这些角色的范围用 OR 合起来。

挑角色的规则取决于接口上的 `@RequirePerm`：

| 接口上 | 哪些角色算数 |
| --- | --- |
| 没有 `@RequirePerm` | 用户所有已启用的角色 |
| `@RequirePerm(a, b)` | 拥有 `a` 或 `b`（用户实际拥有的那几个）的角色 |
| `@RequirePerm.all(a, b)` | 拥有 `a` 的角色算一组，拥有 `b` 的角色算一组，两组的范围**取交集** |

也就是说：**一个角色只有给了你这项权限，它的范围才算数**。比如用户有两个角色：A 有"浏览图书"、范围是本部门；B 没有"浏览图书"、范围是全部数据。他浏览图书时只按 A 算，只能看到本部门的图书。

每个角色的范围变成这样的条件：

| 数据范围 | 条件 |
| --- | --- |
| `all` 全部数据 | 这一组不加条件 |
| `picked_depts` 指定部门 | `dept_id IN (所选部门)` |
| `own_dept` 本部门 | `dept_id = 我的部门` |
| `own_dept_tree` 本部门及下级 | `dept_id IN (SELECT id FROM iam_dept WHERE tree_path LIKE '我的部门路径%' AND deleted_at IS NULL)` |
| `own_rows` 仅本人 | `created_by = 我`（`owner` 指定的列） |

一组角色合起来一个条件也没有时（比如"本部门"但用户没有部门、"指定部门"但一个部门都没选），这一组加的是 `1=0`。所有的值都是绑定参数，不会拼进 SQL。

五种范围的说明见仓库的[数据权限文档 · 五种范围](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/data-scope.md#五种范围)，规则链和多租户的边界见[超管、系统任务与缓存边界](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/data-scope.md#超管系统任务与缓存边界)。

::: info 规则链
`BaseCrudService` 上有一个受保护的 `scopeRules` 字段，默认是 `[deptScopeRule(), tenantRule]`，子类可以替换。`tenantRule` 是为多租户预留的位置，模板没有实现多租户，它**什么都不做**，也不提供任何租户隔离。
:::

### 读：scopedQb

`BaseCrudService` 的列表、详情、导出都从 `scopedQb()` 开始，自动带上范围条件：

```ts
// apps/server/src/core/db/base-crud.service.ts（节选）
scopedQb(alias: string): SelectQueryBuilder<E> {
  const qb = this.repo.createQueryBuilder(alias)
  const columns = dataScopeOf(this.entity)
  return columns ? applyScopes(qb, alias, columns, this.scopeRules) : qb
}

async get(id: number): Promise<E> {
  const row = await this.scopedQb('t').andWhere('t.id = :id', { id }).getOne()
  if (!row) throw new NotFoundException()
  return row
}
```

自己写的查询也从它开始。图书导入按 ISBN 找已有记录时，只找范围内的：

```ts
// apps/server/src/modules/demo/book/book.service.ts（节选）
const found =
  mode === 'upsert'
    ? await this.scopedQb('t')
        .select('t.id')
        .andWhere('t.isbn = :isbn', { isbn: row.value.isbn })
        .getOne()
    : null
```

::: warning 只用 andWhere
范围条件已经在查询上了，再调用 `.where()` 会**把它替换掉**。原生 SQL 和 `this.repo.find…()` 也不会自动加范围。详见[查询](/core/query)。
:::

### 改和删：lockScopedIds

按 id 修改或删除之前，先在事务里锁定这些行，并确认它们都在范围内：

```ts
// apps/server/src/core/db/base-crud.service.ts（节选）
async lockScopedIds(ids: readonly number[]): Promise<void> {
  // getRawMany does not enforce it, and FOR UPDATE in autocommit releases the lock at once
  if (!this.txHost.isTransactionActive()) throw new Error('lockScopedIds needs a transaction')
  const wanted = [...new Set(ids)]
  if (!wanted.length) return
  const rows = await this.scopedQb('t')
    .select('t.id', 'id')
    .andWhere('t.id IN (:...lockIds)', { lockIds: wanted })
    .setLock('pessimistic_write')
    .getRawMany<{ id: number }>()
  if (rows.length !== wanted.length) throw new NotFoundException()
}
```

- 有一个 id 不存在或者超出范围，整个请求返回 **404**，一行都不改；
- 必须在事务里调用，否则直接报错；
- 基类的 `update()` 和 `remove()` 已经调用了它。

自己写的按 id 操作，第一步就调用它。比如重置密码：

```ts
// apps/server/src/modules/platform/iam/user/user.service.ts（节选）
async resetPassword(id: number, body: unknown): Promise<void> {
  // … 校验密码、计算哈希
  await this.after(
    this.txHost.withTransaction(async (): Promise<After> => {
      await this.lockScopedIds([id])                     // ① 锁定并检查范围
      this.assertManageable(await this.rolesOf(id))       // ② 业务规则：非超级管理员不能改超级管理员
      await this.repo.update(id, { passwordHash: hash, passwordChangedAt: null })   // ③ 按主键修改
      return { revoke: PASSWORD_RESET }
    }),
    id,
  )
}
```

这个结构的完整说明见[服务 · 按 id 修改的标准写法](/core/service#按-id-修改的标准写法)。

### 新增和修改：assertWritableScope

写入之后的这一行，也必须在当前用户的范围内：

- **新增**：`create()` 用"提交的数据 + 创建人是我"来判断；
- **修改**：`update()` 只在提交的数据改了部门列或本人列时，用"原来的行 + 提交的数据"来判断；
- 超出范围返回 **404**。

判断用的是和读取**同一套**规则，所以"能写进去"和"写完能看到"永远一致。没有填部门时按空值判断：只有"全部数据"或"仅本人"的角色能保存这样的行，"本部门"的角色会得到 404。

基类的 `create()`、`update()` 已经调用了它。自己用 `this.repo.save()` 写新行时，要自己先调用：

```ts
await this.assertWritableScope({ ...row, createdBy: clsGet('principal')?.userId ?? null })
```

### 超出范围一律 404

`get`、`lockScopedIds`、`assertWritableScope` 遇到范围外的数据，都抛出 `NotFoundException`，和"数据不存在"完全一样。

::: tip 为什么不是 403
返回 403 等于告诉对方"这条记录存在，只是你没有权限"。统一返回 404，就不会泄露记录是否存在。自己写的代码也要遵守：范围外的数据，按不存在处理。
:::

### 架构检查

`pnpm verify` 中的 `scripts/arch/scoped-access.mjs` 会检查：注入了带数据范围实体的服务的控制器里，每个带 `:id` 路径参数或 `ids` 请求体的非 GET 接口，都要能走到 `lockScopedIds`（直接调用，或者调用的服务方法里调用了它，包括继承自基类的方法）。

它只认 `this.<字段>.<方法>()` 这种调用。通过局部变量、辅助函数，或者把 Repository 直接注入控制器，它是看不出来的。这些情况要靠代码评审和数据范围的 e2e 测试来保证。

### 不是基类实体时：applyScopes

有些数据不是通过 `BaseCrudService` 读写的，比如流程实例表。可以直接调用 `applyScopes`，自己告诉它按哪两列判断：

```ts
// apps/server/src/modules/workflow/admin/wf-admin.service.ts（节选）
/** The data scope of instances (admin pages): the initiator's dept, and the initiator for `own_rows`. */
export const WF_INSTANCE_SCOPE: DataScopeColumns = {
  dept: 'initiator_dept_id',
  owner: 'initiator_id',
}

export const scopedInstances = <Q extends SelectQueryBuilder<ObjectLiteral>>(qb: Q): Q =>
  applyScopes(qb, 'i', WF_INSTANCE_SCOPE, defaultScopeRules())
```

流程的实例管理、任务管理和审批数据，都通过 `scopedInstances` 查询，按发起部门（`initiator_dept_id`，发起申请时发起人所在的部门，之后不再改变）过滤。

### 按另一个权限点算范围：withCheckedPerm

范围默认按当前接口检查的权限点算。有时要按**别的**权限点算，比如审批详情接口：发起人、办理人和抄送人可以直接看；其他人要有 `wf.instance.view`，并且实例在这项权限的范围内：

```ts
// apps/server/src/modules/workflow/center/wf-detail.service.ts（节选）
/** A `wf.instance.view` holder whose scope covers the instance (root: any). */
private viewerOf(id: number): Promise<boolean> {
  return withCheckedPerm({ perms: [wfPerms.instance.view], all: false }, () =>
    applyScopes(
      this.txHost.tx.getRepository(WfInstanceRow).createQueryBuilder('i').where('i.id = :id', { id }),
      'i',
      WF_INSTANCE_SCOPE,
      defaultScopeRules(),
    ).getExists(),
  )
}
```

- 第一个参数的写法和 `@RequirePerm` 一样：`{ perms, all }`；传 `undefined` 表示"所有角色都算"；
- 范围在**创建查询的时候**读取，所以查询要在回调里面创建；
- 当前用户和当前事务都保持不变。

### 不受数据范围限制：@SkipDataScope

系统任务（比如定时任务）要读全部数据时，在方法上加 `@SkipDataScope()`。只对这一次调用生效：

```ts
// apps/server/test/fixtures/scoped-note/scoped-note.service.ts（节选）
import { SkipDataScope } from '../../../src/core/data-scope/data-scope.js'

/** A system job's view: every live row, whoever (if anyone) calls. */
@SkipDataScope()
countAll(): Promise<number> {
  return this.scopedQb('n').getCount()
}
```

::: danger 不要用在接口上
`@SkipDataScope()` 会让任何人都看到全部数据。它只用于没有用户参与的系统逻辑，不要加在控制器调用的方法上。
:::

## 防越权授予

非超级管理员不能把**超过自己**的权限或数据范围交给别人，违反时返回 **403**（`Err.IAM_GRANT_EXCEEDS_OWN`，提示"不能授予超出自己权限或数据范围的角色"）。规则在功能页的[防越权授予](/features/permission#防越权授予)中有说明。

所有判断集中在一个类里：`apps/server/src/modules/platform/iam/role/grant-policy.ts` 的 `GrantPolicy`。各个授权入口在事务里调用它：

| 方法 | 判断什么 | 谁调用 |
| --- | --- | --- |
| `assertMenus(roleId, added)` | 给角色新增的菜单权限 | 角色的"菜单权限" |
| `assertDataScope(roleId, next, prev)` | 角色的数据范围新增覆盖的部门 | 角色的"数据权限" |
| `assertAssignableRoles(added, deptId, kept?)` | 分配给用户的角色 | 新增和编辑用户、分配角色、角色的分配用户 |
| `assertEnabling(roleId)` | 重新启用一个角色 | 角色的启用 |
| `assertMenuWrite(write)` | 修改菜单后，各角色新生效的权限点 | 菜单管理的修改 |
| `assertNotSignupRole(ids)` | 注册默认角色只有超级管理员能改 | 角色的各种写操作 |

超级管理员调用时，这些方法直接返回。

一般的业务模块用不到它。只有当你**新写了一个授权入口**时（比如批量导入用户并带上角色），要在锁定之后调用对应的方法，例如：

```ts
// apps/server/src/modules/platform/iam/user/user.service.ts（节选）
const added = next.filter((r) => !current.includes(r))
await this.grants.assertAssignableRoles(added, deptId, moved ? next : [])
```

只传**新增**的部分：保留或者取消一项授权，不会让别人得到更多。

### 只有超级管理员能做的事

有些设置只允许超级管理员修改，用的是同一个错误码。参数设置里的例子：

```ts
// apps/server/src/modules/platform/settings/param/param.service.ts（节选）
const ROOT_ONLY: ReadonlySet<unknown> = new Set([
  signupParams.enabled,
  signupParams.defaultRoleId,
  signupParams.defaultDeptId,
  WX_MP_ENABLED_PARAM,
])
const assertWritable = (key: unknown): void => {
  if (ROOT_ONLY.has(key) && !clsGet('principal')?.root)
    throw new BizError(Err.IAM_GRANT_EXCEEDS_OWN)
}
```

## 修改了授权数据之后

每个会话里都缓存着用户的角色、权限点、部门和数据范围。它们变化后，要让服务端在下一次请求时重新加载，**唯一的入口**是 `PermVersion`（`apps/server/src/core/auth/perm-version.ts`）：

| 方法 | 什么时候调用 |
| --- | --- |
| `bumpUser(userId)` | 一个用户的角色、部门或启用状态变了 |
| `bumpUsers(ids)` | 一批用户，比如移动了部门下的所有用户 |
| `bumpUsersOfRole(roleId)` | 一个角色的菜单、数据范围或启用状态变了 |
| `bumpAll()` | 任何菜单的修改 |

**一定要在事务提交之后调用。** 在事务里调用的话，并发的请求可能用新版本号加载到旧数据，并一直用下去：

```ts
// apps/server/src/modules/platform/iam/role/role.service.ts（节选）
async setMenus(id: number, { menuLink, menuIds }: RoleMenusBody): Promise<void> {
  await this.txHost.withTransaction(async () => {
    // … 替换菜单，GrantPolicy 检查
  })
  await this.permVersion.bumpUsersOfRole(id)       // 事务已经提交
}
```

业务模块一般不修改这些数据，也就不需要调用。

## 前端

前端用 `v-perm` 指令和 `usePerm()` 按权限点显示或隐藏按钮，权限变化后会自动更新。用法见[权限与翻译](/core/web-perm-i18n)。

## 测试

每个接口的 e2e 测试至少覆盖：成功、没有权限时 **403**、参数错误 **400** 或超出范围 **404**。带数据范围的实体，修改和删除都要测一个范围外的 id。
