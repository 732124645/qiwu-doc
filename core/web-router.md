# 路由与菜单

项目中的页面路由**不是在前端写死的**，而是由后端根据当前用户的权限下发。管理员在后台给角色授权哪些菜单，用户就只会看到、只能访问这些页面。

## 工作过程

```text
登录
 → GET /api/auth/menus            后端返回当前用户有权限的菜单树
 → buildRoutes(菜单树)             每个 page 类型的菜单变成一条路由
 → router.addRoute(...)           注册到布局下面
 → 侧边栏按菜单树显示
```

菜单的 `component` 字段对应 `src/views/` 下的文件：

```text
菜单 component = 'demo/book/index'
         ↓
文件  src/views/demo/book/index.vue
```

找不到对应的文件时，这个页面会显示 404。

**所以新增一个页面 = 新建 `.vue` 文件 + 在种子中添加一条菜单记录。** 代码生成器会同时生成这两样。菜单记录的写法见[种子与菜单](/core/seed#菜单和按钮权限)。

## 没有权限时是 404，不是 403

没有被授权的页面**根本不会注册路由**。用户直接在地址栏输入这个地址，看到的是 404，而不是"没有权限"。这样不会暴露"这里有一个你看不到的页面"。

管理员修改了用户的权限后，用户的下一次请求会发现权限版本号变了，前端自动重新加载菜单：新授权的页面出现，被取消授权的页面消失（当前正在看的页面会变成 404）。

## 菜单的类型

| 类型 | 效果 |
| --- | --- |
| 分组 `group` | 侧边栏中的目录，本身不是页面。目录下只有一个可见的子菜单时，菜单里直接显示这个子菜单，不显示目录；勾选"总是显示目录"（`always_show = 1`）时照常显示目录 |
| 页面 `page`，`link_type = route` | 普通页面，加载 `component` 对应的 `.vue` 文件 |
| 页面，`link_type = iframe` | 在布局中用 iframe 显示 `link_url`，比如"系统接口"（Swagger）。切换到别的标签再回来，iframe **不会重新加载**；关闭标签后移除，点标签的"刷新"会重新加载 |
| 页面，`link_type = external` | 不注册路由，点击菜单时在新标签页中打开 `link_url` |
| 按钮 `action` | 不是页面，只提供权限点 |

## 页面缓存（keep-alive）

在多个标签页之间切换时，希望页面保留原来的状态（查询条件、翻到第几页），需要同时满足三个条件（所有页面共用同一个滚动区域，切换回来后不会回到原来的滚动位置）：

1. 菜单的 `keep_alive = 1`；
2. 菜单的 `component_name` 和页面组件的名字**完全一致**：

   ```ts
   // src/views/demo/book/index.vue
   defineOptions({ name: 'DemoBook' })      // 必须和菜单的 component_name 相同
   ```

3. 页面的标签还开着（关闭标签后缓存会被清除）。

::: warning 最常见的问题
页面缓存不生效，十有八九是 `defineOptions({ name })` 和菜单的 `component_name` 不一样。代码生成器生成的页面已经对应好了，自己手写页面时要注意。
:::

## 隐藏页面

有些页面不在侧边栏中显示，只能从其他页面跳转过去，比如用户管理的"分配角色"页面：

- 在种子中作为 `visible: 0` 的页面，挂在列表页下面；
- 把对应的按钮权限挂在这个隐藏页面下面。给角色授予这个按钮权限，就同时获得了这个页面的路由。

种子的写法见[种子与菜单](/core/seed#隐藏页面)。

### 跳转过去

```ts
// views/platform/iam/user/index.vue
import { useRouter } from 'vue-router'

const router = useRouter()
router.push(`/iam/users/${row.id}/roles`)
```

### 在隐藏页面中读取参数

```ts
// views/platform/iam/user/assign-roles.vue
import { useRoute } from 'vue-router'

defineOptions({ name: 'IamUserAssignRoles' })
const route = useRoute()
const id = Number(route.params.id)
```

### 返回列表并关闭当前标签

```ts
import { useTagsStore } from '@/core/stores/tags'

const tags = useTagsStore()
tags.close((tag) => tag.path === route.path)
await router.push('/iam/users')
```

## 固定路由

少数页面不需要菜单授权，直接写在代码里（`src/core/router/index.ts` 的 `staticRoutes`）：

| 路径 | 页面 |
| --- | --- |
| `/login`、`/register`、`/password-reset` | 登录、注册、找回密码（不需要登录） |
| `/password-change` | 强制修改密码 |
| `/lock` | 锁屏 |
| `/sso` | 单点登录的授权同意页（需要登录；没登录时先到登录页，登录后回来），见[单点登录（OAuth2）](/features/oauth) |
| `/403`、`/404` | 错误页 |
| `/503` | 服务端暂时连不上（不需要登录），见下面的[路由守卫的流程](#路由守卫的流程) |
| `/profile` | 个人中心（登录即可访问） |
| `/inbox` | 我的消息 |
| `/redirect/:path` | 用于刷新当前页面 |

`/profile`、`/inbox`、`/redirect/:path` 显示在布局里，其余的页面都不在布局里。其中登录、注册、找回密码、强制修改密码、锁屏和同意页共用一个外框组件 `src/core/layout/AuthPage.vue`。

确实需要加一个固定路由时（比如每个登录用户都能看的页面），加在 `/` 的 `children` 中，就会显示在布局里：

```ts
{
  path: '/profile',
  name: 'profile',
  component: () => import('@/views/profile/index.vue'),
  meta: { title: 'profile.title', icon: 'lucide:user-round' },
},
```

需要权限时，加上 `meta: { perm: 'xxx.yyy.zzz' }`，没有权限的用户会被带到 403 页面。**一般情况下不要这样做**，应该使用菜单和种子，这样管理员才能在后台控制它。

### 固定路由的名字是保留的

菜单的"路由名"不能和固定路由的 `name` 相同（比如 `profile`、`sso`、`my-inbox`），否则保存菜单时返回 400，这个字段提示"路由名已被内置页面占用"。因为同名的菜单路由注册时会替换掉内置页面。

这份名单是 `packages/shared/src/common/reserved-names.ts` 中的 `WEB_STATIC_ROUTE_NAMES`。新增固定路由时，要把它的 `name` 加进这份名单，并把它（带短横线的名字取第一段，比如 `my-inbox` 取 `my`）加进同一文件的保留名 `pages`，否则架构检查（`pnpm verify`）会报错。

## 路由守卫的流程

每次切换页面时：

1. 需要修改密码 → 跳到修改密码页面；
2. 公开页面 → 直接放行；
3. 没有访问令牌 → 用刷新令牌换一个，再读取当前用户；刷新被拒绝时跳到登录页（带上 `redirect` 参数，登录后回到原页面）；
4. 已锁屏 → 跳到锁屏页面；
5. 菜单还没加载 → 加载菜单、注册路由，然后重新匹配；
6. 有 `meta.perm` 但没有权限 → 403；
7. 放行。

第 3 步和第 5 步遇到网络错误、429 或 5xx（服务端正在重启）时，不会跳到登录页，而是退避重试约 20 秒；仍然失败就跳到 `/503`（同样带上 `redirect`），页面上的"重试"会回到原页面再试一次。详见[接口请求 · 服务端暂时连不上](/core/web-request#服务端暂时连不上)。

页面标题会自动设置为"页面名称 - 系统名称"（可以在页面设置中关闭）。系统名称取 `apps/web/.env.development` / `.env.production` 里的 `VITE_APP_TITLE`；没有设置时用翻译 `common.app.title`，跟着界面语言切换。侧边栏和登录页上的系统名称也是这样取的。

## 路由的 meta 字段

| 字段 | 说明 |
| --- | --- |
| `title` | 页面标题（翻译键） |
| `icon` | 图标 |
| `hidden` | 是否在侧边栏中隐藏 |
| `keepAlive` | 是否缓存 |
| `componentName` | 缓存用的组件名 |
| `public` | 不需要登录 |
| `perm` | 需要的权限（只用于固定路由） |
| `menuId` | 对应的菜单 id |
| `linkUrl` | iframe 的地址 |
