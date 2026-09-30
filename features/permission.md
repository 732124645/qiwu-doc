# 权限与数据范围

权限分两层：**能不能做**（功能权限，按菜单和按钮控制）和**能看到哪些数据**（数据范围，按部门控制）。两层都由服务端强制执行，前端的隐藏按钮只是为了界面友好。

## 功能权限

### 权限点写法

格式是 `<域>.<资源>.<动作>`：

```text
iam.user.browse        用户列表
iam.user.create        新增用户
iam.user.reset-password  重置密码
scheduler.job.run      立即执行任务
```

常用动作有 `browse`（列表）、`view`（详情）、`create`、`modify`、`remove`、`export`、`import`，模块也可以自定义动作（kebab-case 写法）。

每个模块在共享包里导出自己的权限常量，前后端引用同一份：

```ts
// packages/shared/src/platform/iam/user.schema.ts
export const userPerms = { browse: 'iam.user.browse', create: 'iam.user.create', /* … */ }
```

### 后端

```ts
@RequirePerm(userPerms.modify)               // 满足其中任一即可
@RequirePerm.all(userPerms.view, userPerms.export)   // 必须全部满足
@Put(':id')
update(...) {}
```

所有接口默认都要求登录，用 `@Public()` 声明公开接口。

### 前端

```vue
<el-button v-perm="userPerms.create">新增</el-button>
<el-button v-perm="[userPerms.modify, userPerms.remove]">…</el-button>  <!-- 满足任一即可 -->
```

```ts
const { has, all } = usePerm()
if (has(userPerms.export)) { /* … */ }
```

### 权限何时生效

用户的权限等于**已启用角色**所关联的**已启用菜单**上的权限点之和。管理员修改角色、菜单或者用户的角色后，**对方不需要重新登录**：下一次请求时服务端发现权限版本号变了，会自动重新加载权限。

## 数据范围

角色上可以设置五种数据范围：

| 编码 | 含义 |
| --- | --- |
| `all` | 全部数据 |
| `picked_depts` | 指定的部门 |
| `own_dept` | 本部门 |
| `own_dept_tree` | 本部门及下级部门 |
| `own_rows` | 仅本人创建的数据 |

用户有多个角色时，取这些范围的并集。超级管理员不受数据范围限制。

### 在实体上声明

```ts
@DataScoped({ dept: 'dept_id', owner: 'created_by' })
@Entity('crm_customer')
export class Customer extends BaseEntity { /* … */ }
```

声明之后，`BaseCrudService` 会自动处理：

- **读取**：列表、详情、导出、下拉选项都经过同一个入口 `scopedQb()`，自动加上范围条件；
- **修改和删除**：先用 `lockScopedIds(ids)` 在事务里锁定并确认这些记录都在范围内，只要有一条超出范围，整个请求就返回 **404**；
- **新增和编辑**：提交的 `dept_id` 必须在自己能写的范围内。

::: tip 为什么是 404 而不是 403
返回 403 等于告诉对方"这条记录存在，只是你没有权限"。统一返回 404，就不会泄露记录是否存在。
:::

项目里有一个架构检查脚本：带数据范围的实体，它的修改和删除接口如果没有经过 `lockScopedIds`，`pnpm verify` 就会失败。

## 防越权授予

非超级管理员在分配权限时，不能给出**超过自己**的权限：

1. 给角色授权菜单时，只能勾选自己拥有的权限点；
2. 设置角色的数据范围时，不能设为"全部"，指定的部门也必须在自己的范围内；
3. 给用户分配角色时，这个角色的权限点和数据范围都不能超过自己。

违反时返回 403。这样可以防止"我能管角色，就给自己建一个超级角色"这类提权操作。

## 超级管理员

角色编码为 `root` 的内置角色拥有全部权限（`*`），不受数据范围限制。这个角色和它的用户不能被删除、停用或者修改角色，非超级管理员也不能把它分配给别人。
