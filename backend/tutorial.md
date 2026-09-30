# 手把手：加一个自定义操作

这一章我们完整地做一个功能，从后端一直做到前端。

**需求**：客户列表的每一行加一个"升级为 VIP"按钮。

- 需要单独的权限 `crm.customer.upgrade`，不是所有能修改客户的人都能升级；
- 已停用的客户不能升级，要提示"客户已停用，不能升级"；
- 升级时记录成为 VIP 的时间；
- 要记操作日志。

::: tip 前提
先按[新增业务模块](/guide/new-module)生成好客户模块 `crm_customer`。下面的步骤是在生成的代码上继续开发。
:::

我们会依次修改这些文件：

```text
① apps/server/src/db/migrations/…-crm-customer-vip.ts   加一列
② apps/server/src/modules/crm/customer/customer.entity.ts        实体加字段
③ packages/shared/src/crm/customer.schema.ts            权限常量、返回字段
④ packages/shared/src/common/error-codes.ts               错误码
⑤ apps/server/src/i18n/{zh-CN,en-US}/error.json           错误信息翻译
⑥ apps/server/src/modules/crm/customer/customer.service.ts       业务逻辑
⑦ apps/server/src/modules/crm/customer/customer.controller.ts    接口
⑧ apps/server/src/modules/crm/customer/customer.seed.ts          按钮权限写进菜单
⑨ apps/web/src/api/crm/customer.ts                       前端接口
⑩ apps/web/src/views/crm/customer/index.vue              按钮
⑪ apps/web/src/locales/{zh-CN,en-US}/*.json                界面翻译
⑫ apps/server/test/e2e/crm-customer-extra.e2e-spec.ts      测试
```

看起来文件很多，但每个文件只改几行。**这就是全栈开发的日常：一个功能会贯穿好几层。**

## ① 迁移：加一列

要记录"成为 VIP 的时间"，表里需要一个新列。表结构只能通过迁移修改：

```ts
// apps/server/src/db/migrations/20261002100000-crm-customer-vip.ts
import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CrmCustomerVip20261002100000 implements MigrationInterface {
  name = 'CrmCustomerVip20261002100000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE crm_customer ADD COLUMN vip_since datetime(3) NULL COMMENT '成为 VIP 的时间' AFTER level`,
    )
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE crm_customer DROP COLUMN vip_since')
  }
}
```

```bash
pnpm db:migrate
```

## ② 实体：加字段

```ts
// customer.entity.ts
/** 成为 VIP 的时间 */
@Column({ name: 'vip_since', type: 'datetime', precision: 3, nullable: true })
vipSince: Date | null
```

数据库里的列名是 `vip_since`（下划线），代码里的属性名是 `vipSince`（驼峰），用 `name` 把两者对应起来。

## ③ 共享包：权限常量和返回字段

在生成的 `customer.schema.ts` 里：

```ts
export const customerPerms = {
  browse: 'crm.customer.browse',
  // …生成的其他权限
  upgrade: 'crm.customer.upgrade',        // 新增
} as const

export const customerVo = z.object({
  // …生成的其他字段
  vipSince: z.iso.datetime().nullable(),  // 新增：接口返回这个字段
})
```

权限常量放在共享包里，是为了让后端的 `@RequirePerm` 和前端的 `v-perm` 使用**同一个字符串**，不会一边写错。

## ④ 错误码

业务错误码使用 `E1xxx` 号段。在 `packages/shared/src/common/error-codes.ts` 的 `Err` 对象里加一行（编号选一个还没用过的）：

```ts
CRM_CUSTOMER_DISABLED: def('E1001', 422, 'error.crm.customer_disabled'),
```

三个参数分别是：错误码（前端可以根据它做判断）、HTTP 状态码（422 表示"请求格式没问题，但业务规则不允许"）、翻译键。

改完共享包之后，重新编译一下（`pnpm dev` 运行时会自动编译）：

```bash
pnpm --filter @qiwu/shared build
```

## ⑤ 错误信息翻译

`apps/server/src/i18n/zh-CN/error.json`：

```json
{
  "crm": {
    "customer_disabled": "客户已停用，不能升级"
  }
}
```

`apps/server/src/i18n/en-US/error.json`：

```json
{
  "crm": {
    "customer_disabled": "The customer is disabled and cannot be upgraded"
  }
}
```

（如果文件里已经有 `crm` 这一项，就加到它下面。）

## ⑥ 服务：业务逻辑

这是最重要的一步。在 `customer.service.ts` 里加一个方法：

```ts
import { Err } from '@qiwu/shared'
import { BizError } from '../../../core/http/biz-error.js'

/** 升级为 VIP：已停用的客户不能升级；已经是 VIP 的不再改动 */
upgrade(id: number): Promise<void> {
  return this.txHost.withTransaction(async () => {
    await this.lockScopedIds([id])                              // 1
    const row = await this.repo.findOneByOrFail({ id })         // 2
    if (!row.enabled) throw new BizError(Err.CRM_CUSTOMER_DISABLED)   // 3
    if (row.level === 'vip') return                             // 4
    await this.repo.update(id, { level: 'vip', vipSince: new Date() })  // 5
  })
}
```

逐行解释：

1. **`withTransaction` + `lockScopedIds`**：开启事务，锁住这一行，并确认这个客户在当前用户的数据范围内。如果不在范围内，或者根本不存在，直接返回 404。**所有"按 id 修改"的方法都要这样开头。**
2. **读出最新的数据**。因为已经加了锁，这里读到的数据在事务结束之前不会被别人修改。
3. **检查业务规则**。抛出 `BizError` 后，事务会自动回滚，前端会收到 422 和翻译好的错误信息。
4. 已经是 VIP 的就不再处理，这样重复点击也不会出问题。
5. **真正修改数据**。`updated_by` 和 `updated_at` 会自动填写。

::: warning 为什么不能先查再改，不加锁？
假设不加锁：管理员 A 点"升级"的同时，管理员 B 点了"停用"。A 读到的客户还是启用状态，检查通过；接着 B 的停用生效；然后 A 的升级也生效了。结果就是一个"已停用的 VIP"，违反了业务规则。加锁之后，A 和 B 的操作会排队执行，不会出现这种情况。
:::

## ⑦ 控制器：接口

在 `customer.controller.ts` 里加一个路由：

```ts
@Put(':id/upgrade')
@RequirePerm(customerPerms.upgrade)
@ActionLog({ domain: 'crm.customer', verb: 'upgrade' })
@ApiOperation({ summary: 'Upgrade a customer to VIP' })
@ApiEnvelope()
upgrade(@Param('id', ParseIntPipe) id: number) {
  return this.customers.upgrade(id)
}
```

- 接口地址是 `PUT /api/crm/customers/:id/upgrade`。按照项目约定，**操作写成子资源**，而不是 `/upgradeCustomer?id=` 这种形式；
- `@RequirePerm`：没有这个权限返回 403；
- `@ActionLog`：每个非 GET 接口**必须**有操作日志（或者显式声明 `@SkipActionLog()`），否则 `pnpm verify` 会失败；
- 动作名 `upgrade` 是新的，**必须先登记**：在 `apps/server/src/db/seeds/audit/audit.seed.ts` 的 `VERBS` 数组里加一行 `['upgrade', '升级', 'Upgrade', 'primary']`，否则 `pnpm verify` 会报错。这个数组同时是操作日志页面显示动作名称的字典。能用已有的动作名（比如 `modify`）时，就不用登记；
- 控制器只有一行逻辑，调用服务就行。

## ⑧ 种子：把按钮权限写进菜单

权限要出现在"角色 → 菜单授权"的树里，管理员才能勾选。在 `customer.seed.ts` 的 `ACTIONS` 数组里加一行：

```ts
const ACTIONS: [perms: string, name: string][] = [
  [customerPerms.browse, 'menu.action.browse'],
  // …
  [customerPerms.upgrade, 'menu.action.upgrade'],     // 新增
]
```

`menu.action.upgrade` 是这个按钮在菜单树中显示的名称（翻译键），在第 ⑪ 步添加翻译。

```bash
pnpm db:seed      # 种子可以重复执行，已存在的数据会被更新而不是重复插入
```

然后用 `admin` 登录，到 **系统管理 → 角色**，给需要的角色勾选"升级为 VIP"。

## ⑨ 前端接口

`apps/web/src/api/crm/customer.ts`：

```ts
export const customerApi = {
  ...crudApi<CustomerVo, CustomerCreate>(BASE),
  // …
  upgrade: (id: number) => api.put(`${BASE}/${id}/upgrade`),     // 新增
}
```

## ⑩ 页面按钮

在列表页 `index.vue` 的 `<script setup>` 里：

```ts
import { ElMessage, ElMessageBox } from 'element-plus'

async function upgrade(row: CustomerVo) {
  try {
    await ElMessageBox.confirm(
      t('crm.customer.upgradeConfirm', { name: row.name }),
      t('crud.confirm.title'),
      { type: 'warning' },
    )
  } catch {
    return                                 // 用户点了取消
  }
  await customerApi.upgrade(row.id)        // 失败时请求层会自动弹出错误信息，这里不用处理
  ElMessage.success(t('crm.customer.upgraded'))
  await refresh()
}
```

在表格的操作列 `#actions` 插槽里加按钮：

```vue
<template #actions="{ row }">
  <!-- …生成的编辑、删除按钮 -->
  <el-button
    v-if="row.level !== 'vip'"
    v-perm="customerPerms.upgrade"
    link
    type="primary"
    @click="upgrade(row)"
  >
    {{ t('crm.customer.upgrade') }}
  </el-button>
</template>
```

注意 `v-perm` **只是隐藏按钮**，让没有权限的人看不到。真正的权限检查在后端的 `@RequirePerm`。即使有人通过开发者工具强行调用这个接口，也会得到 403。

::: tip 按钮的 loading 状态
项目要求"每个提交按钮在请求期间显示 loading 并禁用"。上面的例子使用了确认框，确认框关闭之后请求才发出，用户不容易重复点击；即使重复点击了，第 ⑥ 步第 4 点也能保证结果正确。如果是直接提交的按钮，要加上 `:loading` 状态。
:::

## ⑪ 界面翻译

项目**不允许在 `.vue` 和 `.ts` 里写中文**，所有文字都要放在翻译文件里，并且中英文必须同时添加。

`apps/web/src/locales/zh-CN/crm.customer.json`（生成器已经创建了这个文件，往里面加）：

```json
{
  "crm": {
    "customer": {
      "upgrade": "升级为 VIP",
      "upgradeConfirm": "确定把客户「{name}」升级为 VIP 吗？",
      "upgraded": "已升级为 VIP"
    }
  }
}
```

`apps/web/src/locales/en-US/crm.customer.json`：

```json
{
  "crm": {
    "customer": {
      "upgrade": "Upgrade to VIP",
      "upgradeConfirm": "Upgrade customer \"{name}\" to VIP?",
      "upgraded": "Upgraded to VIP"
    }
  }
}
```

在两种语言的 `menu.json` 的 `menu.action` 下加上 `"upgrade": "升级为 VIP"` / `"upgrade": "Upgrade to VIP"`，这是菜单授权树里显示的按钮名称。

检查有没有漏掉的翻译：

```bash
pnpm i18n:check
```

## ⑫ 测试

后端功能一定要写 e2e 测试，至少覆盖这几种情况：**成功、没有权限（403）、违反业务规则（422）、超出范围或不存在（404）**。

生成的 `crm-customer.e2e-spec.ts` 不要修改（模板更新后它会被重新生成），自定义功能的测试写在旁边的 `crm-customer-extra.e2e-spec.ts` 里：

```ts
it('upgrade: an enabled customer becomes VIP, with vipSince set', async () => {
  const { id } = await addCustomer({ enabled: true })
  await call('put', `/${id}/upgrade`).expect(200)

  const row = (await call('get', `/${id}`).expect(200)).body.data
  expect(row.level).toBe('vip')
  expect(row.vipSince).not.toBeNull()
})

it('upgrade: a disabled customer → 422 with the translated message', async () => {
  const { id } = await addCustomer({ enabled: false })
  const res = await call('put', `/${id}/upgrade`).set('Accept-Language', 'zh-CN').expect(422)
  expect(res.body.code).toBe(Err.CRM_CUSTOMER_DISABLED.code)
  expect(res.body.msg).toBe('客户已停用，不能升级')
})

it('upgrade: an unknown id → 404', async () => {
  await call('put', '/999999/upgrade').expect(404)
})
```

没有权限（403）的测试，需要准备一个没有 `crm.customer.upgrade` 权限的用户，可以参考生成的测试文件里 `reader` 用户的写法。测试文件的完整结构（启动应用、登录、清理数据）请看[写测试](/backend/testing)。

运行：

```bash
pnpm --filter @qiwu/server test crm-customer-extra.e2e
```

## 最后：检查

```bash
pnpm verify
```

它会检查 lint、分层依赖、类型、翻译完整性、操作日志是否齐全、数据范围的写法等。全部通过才算完成。

## 回顾

| 层 | 做了什么 | 为什么 |
| --- | --- | --- |
| 数据库 | 迁移加列 | 表结构只通过迁移修改 |
| 共享包 | 权限常量、错误码 | 前后端共用同一份定义 |
| 服务 | 事务 + 锁 + 业务规则 | 业务规则必须在后端保证 |
| 控制器 | 路由 + 权限 + 日志 | 声明式，只调用服务 |
| 种子 | 按钮权限 | 管理员才能在角色里勾选 |
| 前端 | 按钮 + 确认框 + 翻译 | 界面友好，但不负责安全 |
| 测试 | 成功、403、404、422 | 证明规则真的生效 |

做过一遍之后，你会发现大部分功能都是这个套路。
