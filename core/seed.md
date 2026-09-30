# 种子与菜单

**种子**就是项目初始化时写入数据库的数据：菜单和按钮权限、字典、参数、默认角色、管理员账号、消息模板、定时任务……

和迁移的区别：

| | 迁移 | 种子 |
| --- | --- | --- |
| 修改什么 | 表**结构** | 表里的**数据** |
| 执行几次 | 每个迁移只执行一次 | 可以反复执行，结果一样 |
| 命令 | `pnpm db:migrate` | `pnpm db:seed` |

## 执行种子

```bash
pnpm db:seed                           # 执行全部
pnpm db:seed -- --only iam,settings    # 只执行某几个领域
```

- 所有种子在**一个事务**中执行，任何一个出错都会全部回滚；
- 种子是**幂等**的：反复执行不会重复插入数据；
- `pnpm db:reset` = 清空数据库 + 执行迁移 + 执行种子。

## 种子的规则

种子用 `upsert` 写入数据（`apps/server/src/db/seeds/upsert.ts`）：

```ts
upsert(q, 表名, 查找条件, 每次都更新的值, 只在新增时写入的值)
```

```ts
await upsert(
  q,
  'cfg_param',
  { param_key: 'crm.vip_threshold' },          // ① 按这个条件查找已有的行
  { name: 'VIP 门槛', group_code: 'crm' },      // ② 每次执行种子都会更新
  { param_value: '10000' },                    // ③ 只在第一次插入时写入
)
```

| 情况 | 结果 |
| --- | --- |
| 没有找到 | 插入 ①②③ |
| 找到了 | 只更新 ② |
| 找到了，但**已被管理员删除** | **什么都不做**，不会恢复，也不会重新插入 |

**管理员可以修改的内容放在 ③**（参数值、模板正文、定时任务的执行时间……），这样重新执行种子时，不会覆盖管理员的修改。

其他辅助函数：

| 函数 | 说明 |
| --- | --- |
| `findId(q, 表名, 条件)` | 查找一行的 id，没有时返回 `undefined` |
| `findRow(q, 表名, 条件)` | 返回 `{ id, deleted }` |
| `insertRow(q, 表名, 行)` | 直接插入 |

JSON 类型的列，直接传对象或数组即可，会自动转换。

## 菜单和按钮权限

菜单表 `iam_menu` 中有三种记录：

| 类型 `kind` | 是什么 | 例子 |
| --- | --- | --- |
| `group` | 侧边栏中的分组（目录） | 系统管理、生成示例 |
| `page` | 一个页面 | 图书 |
| `action` | 页面中的一个按钮权限 | 新增图书、导出图书 |

生成的模块种子是这样的（图书示例）：

```ts
// book.seed.ts
const ACTIONS: [perms: string, name: string][] = [
  [bookPerms.browse, 'menu.action.browse'],
  [bookPerms.view, 'menu.action.view'],
  [bookPerms.create, 'menu.action.create'],
  [bookPerms.modify, 'menu.action.modify'],
  [bookPerms.remove, 'menu.action.remove'],
  [bookPerms.export, 'menu.action.export'],
  [bookPerms.import, 'menu.action.import'],
]

export async function seedBook(q: EntityManager): Promise<string[]> {
  // 找到父菜单分组：被删除时跳过，不存在时报错
  const parent = await findRow(q, 'iam_menu', { route_name: 'demo', kind: 'group' })
  if (!parent) throw new Error('seedBook: the demo menu group is missing')
  if (parent.deleted) return ['seed: the demo menu group was deleted: the book menus are skipped']

  // 页面
  const pageId = await upsert(
    q,
    'iam_menu',
    { route_name: 'demo-book' },
    {
      kind: 'page',
      name: 'menu.demo.book',                 // 菜单名称（翻译键）
      route_path: '/demo/books',              // 浏览器地址
      component: 'demo/book/index',           // 对应 src/views/demo/book/index.vue
      component_name: 'DemoBook',             // 页面组件的名字，用于页面缓存
      keep_alive: 1,                          // 切换标签页时保留页面状态
    },
    // 只在第一次插入时写入：管理员可以在菜单管理中移动页面、修改图标和排序
    { parent_id: parent.id, icon: 'lucide:library', sort_no: 10 },
  )

  // 按钮权限，挂在页面下面
  for (const [i, [perms, name]] of ACTIONS.entries())
    await upsert(q, 'iam_menu', { kind: 'action', perms }, { parent_id: pageId, name, sort_no: (i + 1) * 10 })

  return []          // 返回的字符串会在执行种子时打印出来
}
```

- 页面和分组按 `route_name` 查找，按钮按 `perms` 查找。**永远不要用 id 查找**，因为不同环境中的 id 不一样；
- 菜单名称是**翻译键**，翻译写在前端的 `locales/*/menu.json` 或模块的翻译文件中；
- 按钮名称用通用的 `menu.action.*`（浏览、查看、新增……），自定义动作的按钮要在 `menu.json` 的 `menu.action` 下加上翻译。

### 菜单字段

| 字段 | 说明 |
| --- | --- |
| `parent_id` | 上级菜单 |
| `kind` | `group` / `page` / `action` |
| `name` | 名称（翻译键）；`name_i18n` 可以直接存各语言的文字 |
| `route_name` | 唯一的名字，用来查找这条菜单 |
| `route_path` | 浏览器地址，可以带参数，比如 `/iam/users/:id/roles` |
| `component` | 页面文件，相对于 `src/views/`，不带 `.vue` |
| `component_name` | 页面组件的名字，必须和 `.vue` 中 `defineOptions({ name })` 一致，页面缓存才能生效 |
| `link_type` | `route`（默认）、`iframe`（内嵌网页）、`external`（新标签页打开外部链接） |
| `link_url` | `iframe` 和 `external` 的地址 |
| `perms` | 按钮的权限点，比如 `demo.book.create` |
| `icon` | 图标，比如 `lucide:library` |
| `sort_no` | 排序 |
| `visible` | 0 表示不在侧边栏中显示（隐藏页面） |
| `keep_alive` | 1 表示切换标签页时保留页面状态 |

### 项目的菜单分组

项目自己的菜单分组（比如 CRM 的"客户关系"），分两步建立：

**1. 在菜单管理中手动建**：**系统管理 → 菜单管理** → 新增，类型选"分组"。

- 分组可以有任意层级；
- **路由名必填**，只能用小写字母、数字和短横线，**保存后不能修改**（种子和生成的页面都靠它找到分组）；
- 表单会按上级的完整路径预填路由名：在 `/erp` 下建 `/erp/sale`，路由名预填为 `erp-sale`。

**2. 写进种子文件**：`apps/server/src/db/seeds/project/menu-groups.seed.ts`。第 1 步只改了你自己的数据库，写进这个文件，其他环境执行种子时才会有同样的分组：

```ts
export const PROJECT_MENU_GROUPS: ProjectMenuGroup[] = [
  // 上级写在前面
  { routeName: 'erp', parent: null, name: '企业资源', nameI18n: { 'zh-CN': '企业资源', 'en-US': 'ERP' }, routePath: '/erp', icon: 'lucide:factory', sortNo: 60 },
  { routeName: 'erp-sale', parent: 'erp', name: '销售管理', nameI18n: { 'zh-CN': '销售管理', 'en-US': 'Sales' }, routePath: '/erp/sale', icon: null, sortNo: 10 },
]
```

不用自己手写：代码生成器生成模块时，会**打印这个模块的父分组链上的所有分组**（从当前数据库中读取），复制还没有的那几行即可。

| 字段 | 说明 |
| --- | --- |
| `routeName` | 路由名，和菜单管理中的一致 |
| `parent` | 上级分组的路由名：内置分组（比如 `biz`）、这个文件中写在前面的分组，或者 `null`（顶级） |
| `name`、`nameI18n` | 名称。这里可以直接写中文 |
| `routePath`、`icon`、`sortNo` | 路径、图标、排序 |

这个文件的规则：

- **只插入不存在的分组**。分组已经存在，或者已经被管理员删除，都不会改动它（分组归管理员管理）；
- 上级分组已被删除时，这个分组也以"已删除"的状态插入，并打印提示；它下面的分组和模块都会被跳过；
- `parent` 指向的分组既不是内置的，也没有写在前面时，报错。

### 模块的页面挂在分组下

生成的模块种子按路由名找父分组：

| 父分组的状态 | 结果 |
| --- | --- |
| 存在 | 正常建立页面和按钮 |
| 已被管理员删除 | 跳过这个模块的菜单，打印提示，其他种子照常执行 |
| 不存在 | 报错，提示把分组加到 `menu-groups.seed.ts` 中 |

生成的页面，**父菜单、图标、排序只在第一次插入时写入**。管理员在菜单管理中把页面挪到别的分组、换了图标或排序，重新执行种子不会改回去（名称、路径、页面文件和按钮权限仍然每次更新）。

内置的分组有：首页 `home`、流程审批 `workflow`、**业务管理 `biz`**、系统管理 `system`、系统监控 `monitor`、消息中心 `messaging`、文件管理 `storage`、日志管理 `audit`、系统工具 `devtools`、生成示例 `demo`、流程管理 `wf-admin`。

### 隐藏页面

有些页面不出现在侧边栏中，只能从别的页面跳转过去，比如用户管理中的"分配角色"页面。把它作为 `visible: 0` 的页面，挂在列表页下面，并且把相应的按钮权限挂在这个隐藏页面下：

```ts
// user.seed.ts（简化）
const rolesPageId = await upsert(q, 'iam_menu', { route_name: 'iam-user-roles' }, {
  parent_id: pageId,                        // 挂在用户管理页面下面
  kind: 'page',
  name: 'menu.iam.userRoles',
  route_path: '/iam/users/:id/roles',
  component: 'platform/iam/user/assign-roles',
  component_name: 'IamUserAssignRoles',
  visible: 0,                               // 不在侧边栏中显示
  keep_alive: 0,
})
// "分配角色"按钮权限挂在隐藏页面下：给角色授予这个权限，就同时获得了这个页面
await upsert(q, 'iam_menu', { kind: 'action', perms: userPerms['assign-roles'] }, { parent_id: rolesPageId, … })
```

前端跳转：`router.push(`/iam/users/${row.id}/roles`)`。详见[路由与菜单](/core/web-router#隐藏页面)。

## 注册种子

模块的种子函数，要加到 `apps/server/src/db/seeds/index.ts` 的 `SEEDS` 中。项目模块统一放在 `SEEDS.project`：

```ts
const SEEDS: Record<string, Seed[]> = {
  iam: [seedIam, seedUser, seedRole, seedMenu, seedDept, seedPosition],
  settings: [seedSettings, seedDict, seedDictEntry, seedParameter],
  // …
  demo: [seedDemo, seedBook, seedTopic, seedInvoice, seedDemoRealtime],
  // 最后执行：项目的菜单分组，然后是各模块
  project: [seedProjectMenuGroups, seedCustomer, seedSaleOrder],
}
```

- 按顺序执行：`seedProjectMenuGroups` 必须是第一个，模块的种子放在它后面；
- `pnpm db:seed -- --only project` 只执行项目的种子。

## 其他常见的种子

| 要预置的数据 | 见 |
| --- | --- |
| 字典 | [字典](/core/dict#定义字典-写种子)（`upsertDicts`） |
| 参数 | [参数设置](/core/param#新增参数-写种子) |
| 消息模板 | [消息通知](/core/notify#用种子预置模板)（`upsertTemplates`） |
| 定时任务 | [定时任务](/core/job#用种子创建任务) |

## 种子中的名称

角色、部门、岗位、流程名等种子数据的名称，写成**翻译键**（比如 `seed.role.root`），翻译放在 `packages/shared/src/i18n/{zh-CN,en-US}/seed.json` 中。前端显示时用 `tx()` 翻译，这样切换语言时名称也会跟着变。管理员自己新建的数据是普通文字，`tx()` 会原样显示。
