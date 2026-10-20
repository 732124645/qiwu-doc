---
description: '编写租户感知的代码：新表默认是租户表、实体映射租户列、ORM 自动加租户条件、手写 SQL 自己写 tenant_id、跨租户只走 withTenant / allTenants，以及平台表和全局唯一键在哪里登记。'
---

# 编写租户感知的代码

::: tip 后台怎么用
这一页讲写代码。多租户是什么、怎样打开、租户和套餐怎样管理，见[多租户](/features/multi-tenancy)。
:::

**租户**是使用这套系统的一家公司。所有租户共用一个数据库，每一行数据用 `tenant_id` 列记下它属于哪个租户。多租户开关关闭时，所有请求都在默认租户里运行，所以代码**总是按多租户来写**，开关怎么设都不用改代码。

## 五条规则

- **新表默认是租户表**：迁移里加 `tenant_id bigint unsigned NOT NULL` 列，唯一键以它开头，比如 `UNIQUE (tenant_id, order_no, alive)`，这样不同租户可以有相同的值；没有唯一键的表加一个 `KEY idx_<表名>_tenant (tenant_id)`。实体用 `@TenantColumn()` 映射这一列（表里有这一列时，代码生成器生成的实体会自动带上）；
- **ORM 自动加租户条件**：通过 ORM（实体、Repository、QueryBuilder）读、写、计数、子查询和联表时，自动加上当前租户的条件，插入时自动写入当前租户。超级管理员和 `@SkipDataScope()` 也跳不过；
- **手写 SQL 自己写条件**：原始 SQL 不经过 ORM，每张租户表（包括联表进来的）都要带 `<别名>.tenant_id = ?`，插入时写 `tenant_id`。`pnpm verify` 会把漏写的找出来；
- **跨租户只走两个函数**：`withTenant(租户 id, fn)` 在指定的租户里运行，`allTenants(fn)` 不带租户条件运行。每处调用都在旁边写注释 `qw:cross-tenant <理由>`，确实要跨租户的手写 SQL 也一样；
- **平台表和全局唯一键集中登记**：所有租户共用、由平台维护的表（模板里的字典、参数就是这种表），项目自己的这类表登记进 `apps/server/src/db/project-tables.ts` 的 `PROJECT_PLATFORM_TABLES`；必须在所有租户里都唯一的键，登记进同一个文件的 `PROJECT_GLOBAL_UNIQUE`，并写明占用的值怎样释放。模板自己的表在 `apps/server/src/core/db/tenant-tables.ts`，两边合并成 `PLATFORM_TABLES` 和 `GLOBAL_UNIQUE`；项目不改这个模板文件，[升级模板](/guide/upgrade)时也就不会在这里冲突。平台表做成的页面，还要把它的路由名加进 `packages/shared/src/common/tenancy.ts` 的 `PLATFORM_ONLY_ROUTES`，否则租户可能拿到一个打开就报 403 的页面。

::: warning 忘了加 tenant_id 会怎样
没有 `tenant_id` 的项目表会被所有租户共享：任何租户都能读写它的全部行。代码生成器导入这样的表时只给提示，不会拦下。
:::

## 例子：手写 SQL

用 `tenantId()` 取当前请求的租户，每张租户表各写一个条件（改写自请假模块）：

```ts
import { tenantId } from '../../../core/context/tenant.js'

const tid = tenantId()
const rows = await this.txHost.tx.query(
  `SELECT t.id FROM wf_task t
     JOIN wf_instance i ON i.id = t.instance_id AND i.tenant_id = ?
    WHERE t.instance_id = ? AND t.tenant_id = ?`,
  [tid, instanceId, tid],
)
```

## 更多

Redis 键、按租户运行的定时任务、实时推送、不需要登录的接口、每个租户都要的初始数据和跨租户测试，也都有对应的写法，见仓库的文档：

- [多租户 · 编写租户感知的项目代码](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/multi-tenancy.md#编写租户感知的项目代码)：完整规则和检查；
- [设计说明 · 多租户](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/design-notes.md#tenancy)：为什么这样设计，以及已知的上限；
- [代码生成 · 建表约定](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/codegen.md#建表软删除与引用约定new-tables)：生成器对租户列和唯一键的要求。

相关页面：[实体与数据库](/core/entity)、[查询](/core/query)、[权限与数据范围](/core/permission)、[多租户](/features/multi-tenancy)。
