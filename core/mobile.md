# 移动端开发

这一页讲怎么开发、调试、构建和发布移动端，以及只要电脑端时怎么把它删掉。移动端有哪些页面、员工能做什么，见[移动端](/features/mobile)。

## 概览

移动端是给员工用的手机客户端，代码在仓库根目录的 `mobile/`，是可选部分。它用 **uni-app** 开发：uni-app 是 DCloud 公司的跨平台框架，用 Vue 3 写一套代码，可以编译成微信小程序、安卓 App、iOS App 和 H5（在手机浏览器里打开的网页）。

| 平台 | 用途 |
| --- | --- |
| 微信小程序 | 正式发布 |
| 安卓 App、iOS App | 正式发布，用 HBuilderX（DCloud 的开发工具）打包 |
| H5 | 只用于开发调试和自动化测试，不作为正式发布的目标 |

::: warning 发布前还要自己完成的事
模板的自动化测试覆盖了单元测试、H5 上的端到端测试，以及小程序的构建和包体积检查。真机上的核对、用真实的 AppID 和模板发送微信订阅消息、上架应用商店和发布小程序，模板没有做过，要按下文的[发布清单](#发布清单)完成。在 Windows 上用 HBuilderX 打包 App、上传小程序也没有验证过。
:::

### 一个独立的工程

`mobile/` **不在**根目录的 pnpm workspace（工作区：一个仓库里的多个包一起安装、互相引用）里。它有自己的：

- `package.json`：依赖和脚本；
- `pnpm-workspace.yaml`：pnpm 配置。和主工程一样，依赖发布满一天才能安装（`minimumReleaseAge: 1440`），需要运行安装脚本的包登记在 `allowBuilds` 里；
- `pnpm-lock.yaml`：锁定文件。

所以根目录的 `pnpm i` 不会安装移动端的依赖，根目录的锁定文件里也没有它。移动端单独用 `pnpm mobile:install` 安装。

主工程（`apps`、`packages`、`scripts` 和根目录的配置）不能引用 `mobile/`，只有少数几行例外，见[只要电脑端：删除移动端](#只要电脑端-删除移动端)。`pnpm verify` 的架构检查会检查这一点。

### 怎么用共享包

移动端和电脑端共用 `@qiwu/shared` 里的校验规则、类型、权限常量和翻译（`validation.*`、`field.*`、`seed.*`）。它不走 workspace 链接，而是直接用共享包的 TypeScript 源码：

```ts
// mobile/vite.config.ts（节选）
resolve: {
  alias: {
    '@': resolve(__dirname, 'src'),
    '@qiwu/shared': resolve(__dirname, '../packages/shared/src'),
    zod: resolve(__dirname, 'node_modules/zod'),
  },
},
```

- `@` 指向 `mobile/src`；
- `@qiwu/shared` 指向共享包的源码，所以移动端不需要先构建共享包；
- `zod` 指向 `mobile/node_modules/zod`，应用和共享包只打包一份 zod。`mobile/package.json` 里 zod 的版本要和根目录 `pnpm-workspace.yaml` 的 catalog 一致；
- `mobile/tsconfig.json` 的 `paths` 也这样配置，类型检查和构建看到的是同一份代码。

共享包也要能在小程序里运行，所以 `packages/shared/src` 只能导入 `zod` 和自己的文件，`packages/shared/tsconfig.json` 要保持 `"types": []`（不能用 Node 的 `process`、`Buffer` 等）。往共享包里加代码时要注意这两点，`pnpm verify` 的架构检查也会检查。

### 版本

版本跟着 uni-app 走，全部写死精确版本，不跟主工程一起升级：

| 包 | 版本 | 说明 |
| --- | --- | --- |
| `@dcloudio/*`（uni-app） | 3.0.0-5020620260917001（`@dcloudio/types` 是 3.4.31） | 对应 HBuilderX 5.26 |
| `vue` | 3.4.21 | uni-app 要求的版本，和电脑端不同 |
| `vite` | 5.2.8 | uni-app 要求的版本 |
| `pinia` | 2.2.4 | 状态管理 |
| `vue-i18n` | 9.1.9 | 只用来保存当前语言，文字不用它的翻译函数，见[国际化](#国际化) |
| `@wot-ui/ui` | 2.3.2 | 界面组件库（组件名以 `wd-` 开头） |
| `z-paging` | 2.8.8 | 分页列表：下拉刷新、滚到底加载下一页 |
| `go-captcha-uni` | 1.0.7 | 滑块验证码 |
| `socket.io-client` | 4.8.4 | 实时推送 |
| `zod` | 4.6.5 | 校验，和根目录 catalog 一致 |
| `typescript` / `vue-tsc` | 6.0.3 / 3.3.11 | 类型检查 |
| `vitest` / `@playwright/test` | 3.2.7 / 1.63.0 | 单元测试 / 端到端测试 |

`packageManager` 是 `pnpm@11.28.3`，要求 Node 22.22.1 及以上，和主工程相同。

### 根目录的检查管到哪里

- `pnpm verify` 里的翻译检查（`i18n:check`）也扫描 `mobile/src`：`.ts` 和 `.vue` 里不能写中文字面量，两种语言的翻译要一一对应；许可证检查在 `mobile/` 装过依赖时一并检查它；
- 根目录的 lint 和 Prettier 格式化不处理 `mobile/`；
- `pnpm ci:local` 在 `mobile/` 存在时，依次运行移动端的安装、`verify`、单元测试、H5 构建、小程序构建（含包体积检查），并在电脑端的 Playwright 之后运行移动端的端到端测试。它不构建 App。

## 目录结构

```text
mobile/
├── package.json             # 依赖和脚本（不在根目录的 pnpm workspace 里）
├── pnpm-workspace.yaml      # 自己的 pnpm 配置：allowBuilds、minimumReleaseAge
├── pnpm-lock.yaml           # 自己的锁定文件
├── vite.config.ts           # 别名（@、@qiwu/shared、zod）、H5 的转发、单元测试配置
├── tsconfig.json            # 应用代码的类型检查（tsconfig.node.json 管配置文件和 e2e）
├── playwright.config.ts     # H5 端到端测试
├── license-exceptions.json  # 移动端依赖的许可证例外
├── index.html               # H5 的入口页面
├── e2e/                     # Playwright 用例（mobile-*.spec.ts）
├── scripts/                 # mp-size.mjs（小程序包体积检查）、audit-report.mjs（依赖安全报告）
├── unpackage/res/           # App 图标和启动图（PNG）
└── src/
    ├── main.ts              # 入口，第一行导入 core/jitless.ts
    ├── App.vue              # 应用生命周期（语言、主题、更新检查、实时推送）、颜色令牌和公共样式
    ├── pages.json           # 页面登记、分包、tabBar、导航栏样式
    ├── manifest.json        # 应用名、版本号、AppID、App 权限、图标
    ├── theme.json           # 原生导航栏和 tab 栏的浅色、深色颜色
    ├── core/                # 基础层，见下文
    ├── api/                 # 接口封装（代码生成器生成的放在这里）
    ├── pages/               # 主包：login（启动页）、home、approval、message、mine
    ├── pages-wf/            # 审批分包：start（发起）、detail（审批详情）、form（动态表单渲染器）
    ├── pages-biz/           # 业务分包：leave（请假）、demo/*（代码生成器示例）
    ├── pages-sys/           # 系统分包：inbox、bulletin、profile、password、about、wx-bind
    ├── locales/             # zh-CN、en-US 翻译
    ├── static/              # 自绘的 SVG：tab 图标、插画、空状态、标志
    └── __tests__/           # vitest 单元测试
```

**分包**是小程序的概念：主包在启动时下载，分包在第一次打开它里面的页面时才下载，这样主包更小、启动更快。主包只放登录页和底部的四个页签（**工作台**、**审批**、**消息**、**我的**），其他页面按领域放进 `pages-wf`、`pages-biz`、`pages-sys`。

`dist/`（构建产物）不提交到 git。

## 安装与运行

### 安装依赖

在仓库根目录执行（macOS 和 Windows 命令相同）：

```bash
pnpm mobile:install
```

它等于 `pnpm -C mobile i --frozen-lockfile`：按锁定文件安装，不改锁定文件。第一次运行需要联网。

根目录没有 `mobile:dev` 这样的命令。开发时用 `pnpm -C mobile <脚本>`（`-C mobile` 表示在 `mobile` 目录里运行）：

| 命令 | 平台 | 产物和用法 |
| --- | --- | --- |
| `pnpm -C mobile dev:h5` | H5 | 启动开发服务器，在浏览器里打开 |
| `pnpm -C mobile dev:mp-weixin` | 微信小程序 | 编译到 `mobile/dist/dev/mp-weixin`，用微信开发者工具导入 |
| `pnpm -C mobile dev:app` | App | 编译到 `mobile/dist/dev/app`，用 HBuilderX 导入 |

这三个命令都会一直运行，改了代码会自动重新编译，按 `Ctrl+C` 停止。

### 在浏览器里调试（H5）

日常写页面最方便的是 H5：

1. 在一个终端里运行 `pnpm dev`，启动后端（端口 3000）；
2. 在另一个终端里运行 `pnpm -C mobile dev:h5`；
3. 按终端打印的地址在浏览器里打开，用浏览器开发者工具切换到手机尺寸。

H5 用哈希路由，地址里带 `#`，比如工作台是 `…/#/pages/home/index`。

H5 的开发服务器把 `/api`、`/files`（本地存储的公开文件，比如头像）和 `/socket.io`（实时推送）转发到后端，默认是 `http://127.0.0.1:3000`。后端在本机的其他端口时，用环境变量 `API_PROXY_TARGET` 指定。只验证过指向本机的后端；指向远程的 https 后端时，实时推送可能因来源检查被拒绝，角标退回每 60 秒查询一次：

::: code-group

```bash [macOS]
API_PROXY_TARGET=http://127.0.0.1:3100 pnpm -C mobile dev:h5
```

```powershell [Windows（PowerShell）]
$env:API_PROXY_TARGET='http://127.0.0.1:3100'
pnpm -C mobile dev:h5
```

:::

Windows 上用 `$env:` 设置的变量只在当前终端里有效，关掉终端就没了；要在同一个终端里继续做别的事，先执行 `Remove-Item Env:API_PROXY_TARGET` 清除它。

::: warning 实时推送的转发不要加 changeOrigin
`mobile/vite.config.ts` 里 `/socket.io` 写成对象 `{ target, ws: true }`，没有加 `changeOrigin`。加了之后 `Host` 头会被改写，服务端检查来源时会把页面当成外站，拒绝连接（`forbidden_origin`）。
:::

### 在微信开发者工具里调试小程序

小程序没有转发，要在编译时用环境变量 `VITE_API_BASE` 指定完整的接口地址（以 `/api` 结尾）。不设时请求发往相对路径 `/api`，小程序连不上：

::: code-group

```bash [macOS]
VITE_API_BASE=https://api.example.com/api pnpm -C mobile dev:mp-weixin
```

```powershell [Windows（PowerShell）]
$env:VITE_API_BASE='https://api.example.com/api'
pnpm -C mobile dev:mp-weixin
```

:::

然后打开微信开发者工具，导入 `mobile/dist/dev/mp-weixin`。

Windows 上停止之后，在同一个终端里运行别的命令之前，先执行 `Remove-Item Env:VITE_API_BASE` 清除它。这个变量留着时，`dev:h5` 和 `pnpm mobile:e2e` 构建的 H5 也会直接请求这个地址，不再走转发。

- `mobile/src/manifest.json` 里 `mp-weixin.appid` 为空时，产物里的 AppID 是游客 `touristappid`，可以在开发者工具里看页面，但不能上传。要调试微信登录，就填真实的 AppID，并且和服务端的 `WX_MP_APPID` 一致；
- `manifest.json` 里的 `urlCheck: false` 只让开发者工具不检查合法域名。真机上的体验版和正式版一律检查；
- 模板只验证过用 https 正式域名构建。用本机或局域网的 http 地址调试行不行，没有验证过，以开发者工具里实际发出的请求为准。

### 在手机或模拟器上调试 App

1. 安装 HBuilderX 5.26（和 `@dcloudio/*` 的版本对应），登录 DCloud 账号；
2. 和小程序一样，用 `VITE_API_BASE` 指定**手机能访问到**的接口地址，运行 `pnpm -C mobile dev:app`：

   ::: code-group

   ```bash [macOS]
   VITE_API_BASE=https://api.example.com/api pnpm -C mobile dev:app
   ```

   ```powershell [Windows（PowerShell）]
   $env:VITE_API_BASE='https://api.example.com/api'
   pnpm -C mobile dev:app
   ```

   :::

   Windows 上停止后同样先执行 `Remove-Item Env:VITE_API_BASE`；
3. 在 HBuilderX 里导入 `mobile/dist/dev/app`，运行到手机或模拟器。

HBuilderX 调试时用的是**标准基座**：DCloud 预先做好的调试用 App，运行时把你的代码装进去。标准基座在 iOS 上写死了浅色模式，跟随系统时看不到深色效果，核对深色要用云打包出来的 App。

### 连哪个服务端

| 平台 | 变量 | 什么时候生效 | 不设时 |
| --- | --- | --- | --- |
| H5 | `API_PROXY_TARGET` | 启动开发服务器或预览时，转发的目标 | `http://127.0.0.1:3000` |
| 小程序、App | `VITE_API_BASE` | 编译时写进代码 | `/api`，只有 H5 能用 |

- 实时推送和头像这类文件也用 `VITE_API_BASE` 的源（协议加域名），实时推送的地址是同一个域名下的 `/socket.io`；
- `VITE_API_BASE` 会被编译进代码，所以不能放任何密钥；
- `mobile/` 里没有提交任何 `.env` 文件。uni-app 会不会读取 `mobile/` 下的 `.env.production.local` 这类文件，模板没有验证过，所以一律在命令行里设置变量，并在真机上确认请求发到了哪个地址。

## 基础层

`mobile/src/core/` 是写页面时直接复用的代码：

| 文件 | 提供什么 |
| --- | --- |
| `request.ts` | 接口请求 `api`、上传 `upload`、错误 `ApiError` / `errorText`、文件地址 `assetUrl` |
| `stores/auth.ts` | 登录状态 `useAuthStore`、权限判断 `hasPerm` |
| `stores/counts.ts` | 待办数、审批中数、未读数 `useCountsStore`，工作台和底部角标共用 |
| `realtime.ts` | 实时推送的连接 |
| `i18n.ts` | 翻译 `t` / `tx`、校验提示 `fieldErrors` / `issueText`、切换语言 `setLocale` |
| `theme.ts` | 浅色和深色 `useTheme`、分页列表的主题 `pagingTheme` |
| `format.ts` | 时间和大小的显示：`formatTime`、`formatShort`、`formatSize` |
| `pickers.ts`、`captcha.ts` | 选人、选部门、字典、上传的逻辑；验证码 |
| `approvals.ts`、`views.ts` | 审批列表、详情和操作的逻辑；自定义表单流程的移动端页面登记 |
| `crud.ts` | 代码生成器生成的页面共用的增删改查工具 |
| `update.ts`、`wx-subscribe.ts` | App 更新检查；微信订阅消息 |
| `jitless.ts`、`eio-globals.ts` | 让 zod 和 socket.io 在小程序里不用 `new Function` |
| `components/` | 公共组件，见[常用组件](#常用组件) |

### 请求

不要直接调用 `uni.request`，用 `request.ts` 的 `api`。地址不带 `/api` 前缀，它会自动加上：

```ts
import type { BulletinUnread, Page, WfTaskItemVo } from '@qiwu/shared'
import { api, errorText } from '@/core/request'

// GET：第二个参数是查询参数
const todo = await api.get<Page<WfTaskItemVo>>('/wf/tasks/todo', { page: 1, pageSize: 3 })
// POST、PUT、DELETE
const { unread } = await api.post<BulletinUnread>('/messaging/bulletins/feed/read-all')

// silent：出错时不弹提示、不跳转，由调用方自己处理
try {
  await api.get('/wf/tasks/todo', { page: 1, pageSize: 1 }, { silent: true })
} catch (e) {
  error.value = errorText(e) // 服务端翻译好的提示；没有应答时是"网络异常，请稍后重试"
}
```

成功时返回应答里的 `data`，失败时抛出 `ApiError`（`status` 为 0 表示没有收到应答）。每个请求都带 `X-Client-Id: mobile`、`Accept-Language`（当前语言），能取到时区时还带 `X-Timezone`，超时 30 秒。

出错时的统一处理：

| 情况 | 处理 |
| --- | --- |
| 401 | 用 refresh 令牌刷新一次（几个请求同时 401 时只刷新一次），成功后重发原请求；刷新被拒就清除登录状态，回到登录页 |
| 403 `A1004`（必须先改密码） | 不弹提示，转到改密页 `/pages-sys/password/index` |
| 403、409、422、429、5xx | 弹出服务端返回的提示 |
| 网络错误（没有收到应答） | 弹出"网络异常，请稍后重试" |
| 400、404 | 不弹提示，由页面显示（表单的校验错误、"不存在"） |

加了 `{ silent: true }` 的调用以上都不做，错误交给调用方。

其他几个工具：

- `upload(url, filePath, formData?)`：用 `uni.uploadFile` 经后端上传，文件字段名是 `file`。一般直接用 `QwUpload` 组件，见[文件上传 · 大小上限](/core/upload#大小上限)。上传和普通请求不同：400、404、413（超过大小上限）、415 也会弹出提示；
- `assetUrl('/files/…')`：把服务端返回的 `/files/…` 路径变成能加载的地址（H5 走转发，小程序和 App 加上 `VITE_API_BASE` 的源），完整的 `https://` 地址原样返回。

### 登录状态和权限

账号密码登录和短信登录都带 `clientId: 'mobile'` 和 `keepSignedIn: true`，微信登录由服务端按同样的方式处理。建立的是移动端会话，从登录起最长 7 天，见[登录与账号 · 会话时长](/features/login#会话时长)。

- **access 令牌**（访问令牌）只放在内存里，应用重启后就没有了，第一个请求 401 后自动刷新；
- **refresh 令牌**（刷新令牌）放在 uni 的本地存储里（键 `qw.auth.rt`），刷新时放在请求体里发送（`POST /api/auth/refresh`），应答给出新的 access 令牌和换过的新 refresh 令牌。

```ts
import { hasPerm, useAuthStore } from '@/core/stores/auth'

const auth = useAuthStore()
auth.me?.user.displayName // GET /api/auth/me 的结果
hasPerm('biz.leave.create') // 传数组时有任一权限即可；超级管理员全部通过
```

模板里按权限显示用 `<QwPerm>`，因为小程序不支持自定义指令（电脑端的 `v-perm` 在这里不能用）：

```vue
<QwPerm :perm="bookPerms.create">
  <wd-button type="primary" block @click="create">{{ t('crud.action.create') }}</wd-button>
</QwPerm>
```

`hasPerm` 和 `<QwPerm>` 都只控制显示，权限以服务端为准。

`/auth/me` 返回的 `mustChangePassword` 或 `passwordExpired` 为真时（初始密码、密码过期），应用会一直停在改密页，改完再进入工作台。

### 计数和实时推送

`useCountsStore()` 里有 `todo`（待办数）、`running`（我发起、还在进行的流程数）、`unread`（未读消息数）和 `load()`。工作台和底部角标都读这里。

- 底部页签每次显示时（切换页签、从子页面返回、回到前台）调用一次 `load()`；
- 应用在前台时连接实时推送，收到新待办或新消息就调用 `load()`；被管理员强制下线时回到登录页；
- 实时推送连不上时，页签显示期间每 60 秒查询一次。

连接的时机、处理哪些推送、轮询兜底的写法见[在代码中推送实时消息 · 移动端（uni-app）](/core/realtime#移动端-uni-app)。

### 国际化

文字一律用 `@/core/i18n` 的函数，**不要用 vue-i18n 自带的 `t`、`$t`**：小程序上它不替换 `{name}` 这样的占位符，完整版的 vue-i18n 还会用到小程序禁止的 `new Function`。

```ts
import { fieldErrors, t, tx } from '@/core/i18n'

t('home.hello', { name: user.displayName }) // 你好，{name}
tx(model.name) // 种子数据的名称是翻译键，管理员新建的是普通文字：是键就翻译，否则原样显示
const errors = computed(() => fieldErrors(leaveCreate, issues.value)) // 共享规则的校验提示，见下文
```

- 移动端的文字放在 `mobile/src/locales/{zh-CN,en-US}/*.json`，文件名的合并规则和电脑端相同；`validation.*`、`field.*`、`seed.*` 直接来自共享包，见[在代码中使用国际化](/core/i18n)；
- 启动时依次取：本机保存的选择（键 `qw.locale`）→ 系统语言以英文开头时用 English → 简体中文；
- `setLocale()` 同时切换移动端自己的文字、wot-ui 组件自带的文字和 uni 内置的界面（弹窗、选择器），并保存在本机。在 **我的** 页切换语言时，还会保存到账号上（`PUT /api/iam/profile/locale`），服务端发的消息跟着变；
- 页面标题也要翻译：在 `onLoad` 里调用 `uni.setNavigationBarTitle({ title: t('…') })`，`pages.json` 里的标题只是默认值。

### 主题和样式

- 默认跟随系统的浅色或深色。App 和 H5 可以在 **我的 → 外观** 里选 **跟随系统**、**浅色** 或 **深色**，保存在本机（键 `qw.theme`）；微信小程序只能跟随系统，没有这一项；
- 颜色令牌（`--qw-*`）的浅色值和深色值都定义在 `App.vue`，wot-ui 的 `--wot-*` 变量都指向它们。页面里**不写颜色值**，只用 `--qw-*` 令牌和 `App.vue` 里的公共类（`.qw-card`、`.qw-row`、`.qw-tag`、`.qw-btn` 等）；
- 不要用 wot-ui 的 `<wd-config-provider>`，它的浅色主题类会盖掉上面的映射；
- `z-paging` 的主题统一用 `pagingTheme`：在 `<z-paging>` 上绑定 `:default-theme-style="pagingTheme.style"`、`:loading-more-title-custom-style="pagingTheme.title"` 和 `:loading-more-no-more-line-custom-style="pagingTheme.line"`，可以照抄生成的列表页 `mobile/src/pages-biz/demo/book/index.vue`；
- 原生导航栏、tab 栏和页面底色写在 `src/theme.json`，`pages.json` 用 `@` 变量引用它；
- `src/static/` 下的 tab 图标和空状态插画都有浅色、深色两份，深色的文件名分别带 `-dark` 和 `-night`；深蓝色头部用的梧桐插画（`static/art/`）只有一份，两种主题共用。

`useTheme()` 返回当前的选择 `pref`、是否深色 `isDark`、能否选择 `canChoose` 和设置函数 `setPref`。

### 常用组件

都在 `mobile/src/core/components/`，用的时候显式导入：

| 组件 | 作用 |
| --- | --- |
| `QwPageHeader` | 页签页面顶部的深蓝色头部 |
| `QwTabBar` | 自绘的底部页签栏，带角标。原生 tabBar 不能在运行时改文字（切换语言），所以四个页签页面底部都放 `<QwTabBar current="…">`，原生的被隐藏。它还负责没有登录时回到登录页、刷新计数和连接实时推送 |
| `QwPerm` | 有权限才显示里面的内容 |
| `QwIcon` | 自绘的线条图标，`<QwIcon name="calendar" size="40rpx" />`（`rpx` 是 uni-app 的长度单位，屏幕宽度固定为 750rpx） |
| `QwEmpty` | 空状态，`title`、`desc`，可选一个按钮 `action` |
| `QwBrandMark` | 栖梧标志 |
| `QwCaptcha` | 验证码弹层（滑块或图形） |
| `QwUserPicker` | 选人：`v-model`、`multiple`、`source`。`source="wf"`（默认）列出全部启用的用户，审批里用；`source="iam"` 上方是部门树，只列调用者数据范围内的用户 |
| `QwDeptPicker` | 选部门，任一级都可以选 |
| `QwDictSelect` | 字典下拉：`code` 是字典编码，值是字典项的编码。每个字典在一次运行里只取一次 |
| `QwUpload` | 附件上传：`biz-tag`、`limit`（默认 10 个）、`max-size`（单位是字节，不传时跟随参数 `storage.max_size_mb`） |

选择组件都是一行，点开后从底部弹出。

### 区分平台

两种写法：

- **条件编译**：uni-app 编译时按注释去掉代码，只在某个平台上保留。`#ifdef` 是"只在这个平台"，`#ifndef` 是"除了这个平台"：

```vue
<!-- mobile/src/pages/mine/index.vue（节选）：小程序没有"外观" -->
<!-- #ifndef MP-WEIXIN -->
<wd-action-sheet v-model="appearanceOpen" :actions="appearances" @select="pickAppearance" />
<!-- #endif -->
```

```ts
// mobile/src/pages/login/index.vue（节选）：只在小程序里用微信登录
onLoad(() => {
  if (hasSession()) return goHome()
  // #ifdef MP-WEIXIN
  if (takeWxLaunch()) wxSignIn()
  // #endif
})
```

- **运行时判断**：`process.env.UNI_PLATFORM` 在构建时被替换成 `'h5'`、`'app'` 或 `'mp-weixin'`，比如 `core/update.ts` 开头的 `if (process.env.UNI_PLATFORM !== 'app') return`。

### 小程序的限制

写代码时要记住微信小程序的这些限制：

- **不能用 `new Function` 和 `eval`**。所以 `src/main.ts` 的第一行导入 `core/jitless.ts`（把 zod 设为不生成代码的模式），vue-i18n 的翻译函数不用，socket.io 的一个全局对象由 `vite.config.ts` 里的插件换掉。构建小程序后的包体积检查会查产物里有没有这类代码；
- **不支持自定义指令**：按权限显示用 `<QwPerm>` 或 `hasPerm()`；
- **不支持动态组件**：审批详情里的业务单据是跳转到业务页面，不是嵌进来；动态表单用自己写的渲染器（`pages-wf/form/`）；
- **分包之间不能互相引用**：每个包只能用主包和本包的代码和组件。主包里的页面（比如审批页签）也不能引用分包的代码，所以 `core/views.ts` 里只放页面路径；
- 引入新的依赖之前，确认它能在小程序里运行（不用 Node 的模块、不用 `new Function`），并且许可证能通过 `pnpm mobile:verify`。

## 新增页面

### 手写一个页面

以"关于"页为例，它是最简单的页面：

```vue
<!-- mobile/src/pages-sys/about/index.vue（节选） -->
<template>
  <view class="qw-detail qw-stack">
    <view class="qw-about">
      <QwBrandMark size="120rpx" />
      <text class="qw-about__name">{{ t('common.app.name') }}</text>
      <text class="qw-about__version">{{ `${t('common.version')} ${version}` }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import QwBrandMark from '@/core/components/QwBrandMark.vue'
import { t } from '@/core/i18n'

const version = uni.getAppBaseInfo().appVersion ?? '' // 来自 manifest.json 的 versionName

onLoad(() => uni.setNavigationBarTitle({ title: t('mine.about') }))
</script>
```

步骤：

1. 按领域放进分包：业务页面放 `mobile/src/pages-biz/<模块>/`，系统和个人的页面放 `pages-sys/`，审批的放 `pages-wf/`。不要往主包里加页面；
2. 在 `mobile/src/pages.json` 对应分包的 `pages` 里登记，路径不带分包名和扩展名：

   ```json
   {
     "root": "pages-biz",
     "pages": [
       { "path": "leave/index", "style": {} },
       { "path": "leave/view", "style": {} }
     ]
   }
   ```

3. 文字写进 `mobile/src/locales/zh-CN/` 和 `en-US/` 下的同名文件，两种语言的键一一对应；
4. 用 `uni.navigateTo({ url: '/pages-biz/leave/view?id=1' })` 打开页面，路径以分包名开头；
5. 运行 `pnpm -C mobile dev:h5` 看效果，再运行 `pnpm mobile:verify` 和根目录的 `pnpm verify`（翻译检查）。

### 表单和校验

表单直接用共享包的 zod 规则，和电脑端、服务端是同一份（见[参数校验](/core/validation)）。不通过就不发请求，提示显示在字段下面：

```ts
// mobile/src/pages-biz/leave/index.vue（节选）
import { leaveCreate, type LeaveVo, type ValidationIssue } from '@qiwu/shared'
import { fieldErrors, t } from '@/core/i18n'
import { ApiError, api } from '@/core/request'

const issues = shallowRef<ValidationIssue[]>([])
const errors = computed(() => fieldErrors(leaveCreate, issues.value)) // { 字段名: 提示 }

async function submit() {
  if (submitting.value) return
  const parsed = leaveCreate.safeParse(input())
  issues.value = parsed.error?.issues ?? []
  if (!parsed.success) return
  submitting.value = true
  try {
    const saved = await api.post<LeaveVo>('/biz/leaves', parsed.data)
    uni.redirectTo({ url: `/pages-wf/detail/index?id=${saved.instanceId}` })
  } catch (e) {
    // 400（校验）和 404 显示在页面上，其他错误请求层已经弹出提示
    if (e instanceof ApiError && (e.status === 400 || e.status === 404)) error.value = e.message
  } finally {
    submitting.value = false
  }
}
```

和电脑端一样，提交按钮在请求期间显示加载并禁用，防止重复提交。

### 加一个入口

页面登记后没有入口，只能通过地址打开。最常见的入口是工作台的 **常用功能**，在 `mobile/src/pages/home/index.vue` 的 `SHORTCUTS` 里加一项：

```ts
// mobile/src/pages/home/index.vue（节选）
const SHORTCUTS: Shortcut[] = [
  { name: 'start', icon: 'send', tone: 'brand', url: '/pages-wf/start/index' },
  {
    name: 'leave',
    icon: 'calendar',
    tone: 'success',
    url: '/pages-biz/leave/index',
    perm: leavePerms.create, // 有这个权限才显示
  },
  { name: 'bulletin', icon: 'megaphone', tone: 'warning', url: '/pages-sys/bulletin/index' },
]
```

- `name` 决定文字的键 `home.shortcut.<name>`，在 `locales/*/home.json` 里加上；
- `icon` 是 `QwIcon` 的图标名，`tone` 是颜色（`brand`、`success`、`warning`、`neutral`）。

### 让流程在手机上发起和查看

动态表单的流程不用写代码，手机上自动能发起和查看（有些组件只读，见[工作流 · 手机上的动态表单](/features/workflow#手机上的动态表单)）。

**业务表单**的流程（自己写的业务页面，比如请假）要在 `mobile/src/core/views.ts` 的 `MOBILE_FORMS` 里登记移动端页面，否则手机上显示"请在电脑端查看"，发起时提示"该流程请在电脑端发起"：

```ts
// mobile/src/core/views.ts（节选）
export const MOBILE_FORMS: readonly MobileForm[] = [
  {
    createRoute: '/biz/leave/new', // 流程模型的"发起页路由"
    viewComponent: 'biz/leave/view', // 流程模型的"单据查看组件"
    view: '/pages-biz/leave/view', // 查看页，打开时带 ?id=<单据 id>&readonly=1
    form: '/pages-biz/leave/index', // 新建页；带 ?id=<单据 id>&task=<任务 id> 时是退回后修改
    modify: leavePerms.modify, // 退回后修改单据需要的权限
    icon: 'calendar',
    summary: {
      // 审批详情里显示的单据摘要
      url: '/biz/leaves/:id',
      title: 'leave.form',
      labels: 'field.biz.leave',
      fields: [
        { prop: 'leaveKind', dict: 'biz.leave_kind' },
        { prop: 'startAt', time: true },
        { prop: 'endAt', time: true },
        { prop: 'days' },
        { prop: 'reason' },
      ],
    },
  },
]
```

`createRoute` 和 `viewComponent` 要和电脑端这个流程模型的配置一致，靠它们找到对应的移动端页面。新加的查看页和新建页同样要在 `pages.json` 的 `pages-biz` 里登记。

### 用代码生成器生成

在 **系统工具 → 代码生成** 的编辑页，**生成信息** 页签里打开 **移动端页面**（每张表单独设置，默认关闭），预览、下载和命令行生成（`pnpm gen write <表>`）会多出这些文件：

- `mobile/src/api/<领域>/<模块>.ts`：接口封装；
- `mobile/src/pages-biz/<领域>/<模块>/index.vue`、`detail.vue`、`form.vue`：列表、详情和表单页（只读模块没有表单页）；
- `mobile/src/locales/{zh-CN,en-US}/<领域>.<模块>.json`：翻译片段（实体名和菜单名）。

只有仓库里有 `mobile/src/pages.json` 时才生成。生成器**不改已有的文件**，注册代码的最后几行就是要手工加进 `pages.json` 的内容。以示例的图书模块为例：

```text
mobile/src/pages.json (subpackage "pages-biz"):
  { "path": "demo/book/index", "style": {} }
  { "path": "demo/book/detail", "style": {} }
  { "path": "demo/book/form", "style": {} }
  an entry point is up to the project, e.g. a shortcut in mobile/src/pages/home/index.vue (SHORTCUTS) to /pages-biz/demo/book/index
```

最后一行提醒你：入口要自己加，比如上文的 `SHORTCUTS`。

生成的页面依赖手写的 `mobile/src/core/crud.ts` 和 `locales/*/crud.json`：

```ts
// mobile/src/api/demo/book.ts（生成的）
// @generated by qw-codegen (crud)
import type { BookCreate, BookVo } from '@qiwu/shared'
import { crudApi } from '@/core/crud'

const BASE = '/demo/books'

/** /api/demo/books for the mobile pages: the standard CRUD calls. */
export const bookApi = {
  ...crudApi<BookVo, BookCreate>(BASE),
}
```

`crudApi` 提供 `page`、`get`、`create`、`update`、`remove` 五个方法，对应标准的增删改查接口。

列表页用 `z-paging` 分页（下拉刷新、滚到底加载下一页），只有一个关键字搜索框；新增按钮包在 `<QwPerm :perm="bookPerms.create">` 里。树表一层一层点进下级，主子表的子表每行一张卡片，可以添加、删除行。校验用共享包的 `<模块>Create` 规则，服务端会再校验一次。

生成的移动端页面没有这些，需要时自己补：密文列、关键字以外的筛选、详情里的部门名和用户名（显示编号）、子表单元格上的错误提示。页面的样子见[代码生成器 · 移动端页面](/features/codegen#移动端页面)。

## 构建与打包

| 命令 | 产物 | 说明 |
| --- | --- | --- |
| `pnpm mobile:build:h5` | `mobile/dist/build/h5` | 只用于调试和端到端测试 |
| `pnpm mobile:build:mp-weixin` | `mobile/dist/build/mp-weixin` | 构建后自动检查包体积，见下文 |
| `pnpm mobile:build:app` | `mobile/dist/build/app` | App 的资源，还要用 HBuilderX 打成安装包 |

哪些是自动的、哪些要手工做：

- **自动**：编译三个平台；小程序的包体积检查；`build:app` 把 `mobile/unpackage/res`（图标和启动图）复制到 `dist/build/app/unpackage/res`；
- **手工**：上传小程序（微信开发者工具或 miniprogram-ci）；在 HBuilderX 里打包 App、准备签名证书；提交审核、上架。

小程序和 App 构建时一定要带上 `VITE_API_BASE`，换成你自己的接口域名：

::: code-group

```bash [macOS]
VITE_API_BASE=https://api.example.com/api pnpm mobile:build:mp-weixin
VITE_API_BASE=https://api.example.com/api pnpm mobile:build:app
```

```powershell [Windows（PowerShell）]
$env:VITE_API_BASE='https://api.example.com/api'
try {
  pnpm mobile:build:mp-weixin
  if ($LASTEXITCODE -ne 0) { throw "Mini program build failed" }
  pnpm mobile:build:app
  if ($LASTEXITCODE -ne 0) { throw "App build failed" }
} finally {
  Remove-Item Env:VITE_API_BASE
}
```

:::

只构建一个平台时，保留对应的那一行。

### 小程序包体积检查

`build:mp-weixin` 编译后运行 `mobile/scripts/mp-size.mjs`，打印每个包的大小，下面任一项不满足就失败：

- 主包和每个分包都不超过 2 MB，总共不超过 30 MB（微信的限制）；
- 每个包只引用主包和本包的代码和组件；
- 产物里没有小程序不能运行的代码：`Function("return this")`、`require("ws")`、`xmlhttprequest-ssl`。

`src/static/` 下的文件都打进主包，所以大图片不要放在这里。

### 用 HBuilderX 打包 App

1. 安装 HBuilderX 5.26（和 `@dcloudio/*` 的版本对应），登录 DCloud 账号；
2. 在 `mobile/src/manifest.json` 填好 `appid`（DCloud 应用标识，可以在 HBuilderX 的 manifest 可视化编辑器里获取）、`name`（应用名，模板里是 `Qiwu`）、`versionName` 和 `versionCode`；
3. 带上 `VITE_API_BASE` 运行 `pnpm mobile:build:app`；
4. 在 HBuilderX 里导入 `mobile/dist/build/app`，选 **发行 → 原生 App-云打包**。**云打包**由 DCloud 的服务器打出安装包（安卓的 APK、iOS 的 IPA）。也可以用 DCloud 的离线 SDK 在 Android Studio 或 Xcode 里本地打包。

App 图标和启动图是 `mobile/unpackage/res/{icons,splash}/` 下的 PNG，`manifest.json` 按相对路径引用它们。它们不放在 `src/static`，否则会打进小程序的主包。换图标时，在 HBuilderX 的 manifest 可视化编辑器里用一张 1024×1024 的原图重新生成各种尺寸。

签名证书、隐私政策和上架见下文的[发布清单](#发布清单)。

## 微信小程序登录

员工在小程序里可以直接用微信登录，第一次要绑定员工账号。用户看到的过程和管理员的启用步骤见[登录与账号 · 微信小程序登录](/features/login#微信小程序登录)。代码在这些地方：

| 位置 | 做什么 |
| --- | --- |
| `mobile/src/pages/login/index.vue` | 微信登录的代码只在小程序里编译：本机没有保存登录状态时，每次启动先用微信静默登录一次。已绑定的进入工作台，没绑定的进入绑定页；没有开启（404）或出错时停在登录页 |
| `mobile/src/core/stores/auth.ts` | `wxLogin()`：`uni.login` 拿到临时 code，发给 `POST /api/auth/wx-mp/login`；`wxBind()`：每次提交前重新静默登录，换一张新的绑定票据，再发给 `POST /api/auth/wx-mp/bind` |
| `mobile/src/pages-sys/wx-bind/index.vue` | 绑定页：用账号密码或短信验证码登录一次，按钮是 **绑定并登录** |
| `apps/server/src/modules/platform/iam/social/` | 服务端：向微信换取身份、发绑定票据、绑定 |

本地调试微信登录需要：

1. 在 `apps/server/.env.local` 里加上小程序的 AppID 和 AppSecret（Windows 上用记事本打开：`notepad apps\server\.env.local`），然后重启后端：

   ```ini
   WX_MP_APPID=wx开头的AppID
   WX_MP_SECRET=小程序的AppSecret
   ```

   AppSecret 只能放在这个文件里。`apps/server/.env` 里不要有这两个键，空值也不行，否则会盖住 `.env.local` 里的值；
2. 在 **系统管理 → 参数设置** 里把 `auth.wx_mp.enabled`（微信小程序登录）改为 `true`。开关关闭、或者缺少 AppID 或密钥时，微信登录的接口都返回 404，登录页照常显示账号密码和短信登录；
3. `mobile/src/manifest.json` 的 `mp-weixin.appid` 填同一个 AppID，并带上 `VITE_API_BASE` 编译。

几点细节：

- 绑定票据有效 5 分钟，只能用一次，并且绑定了静默登录时的客户端 IP。应用每次提交绑定前都会重新取一张，所以一般不会过期；
- 退出登录后，同一次启动里不会再自动用微信登录，登录页显示账号密码和短信登录；
- 安全规则见[安全基线 · 微信小程序登录](/features/security#微信小程序登录)。

## 微信订阅消息

有新的审批待办时，可以用微信的一次性订阅消息提醒审批人，默认关闭。用户怎么订阅、参数怎么配，见[消息中心 · 微信订阅消息](/features/messaging#微信订阅消息)。

开发上要知道的：

- 小程序这边在 `mobile/src/core/wx-subscribe.ts`：`loadSubscribeIds()` 调用 `GET /api/iam/profile/socials/wx-mp/subscribe`，拿到可以申请的模板 ID（只在小程序、已绑定微信、开关打开、配了模板时才有）；`requestSubscribe(ids)` 弹出微信的订阅窗口，一次最多 3 个模板；
- `requestSubscribe` 必须在点击事件里**直接**调用，前面不能有 `await`：微信只接受由用户点击发起的订阅请求；
- 服务端在站内信投递成功之后发送，不建表、不重试，订阅的次数由微信保存。实现在 `apps/server/src/modules/platform/iam/social/wx-subscribe.service.ts`；
- 想让别的通知也发微信提醒，不用改代码：在参数 `notify.wx_subscribe.templates` 里按通知的模板编码加一项即可。通知怎么发见[消息通知](/core/notify)；
- 模板自带的自动测试用的是模拟的微信接口，真实的发送要在真机上核对，见[发布清单](#发布清单)。

## App 版本更新

管理员在 **系统管理 → App 版本** 里发布新版本，员工的 App 启动时弹窗提示更新。字段、选择规则和两个参数见[系统管理 · App 版本](/features/system#app-版本)。

App 这边的代码在 `mobile/src/core/update.ts`：

- `App.vue` 的 `onLaunch` 里调用一次 `checkUpdate()`。只有安卓和 iOS 的 App 检查；H5 不检查，小程序由微信在冷启动时自己更新；
- 它把平台、资源版本（`plus.runtime.getProperty` 取到的当前 wgt 版本）和原生版本（`plus.runtime.version`）发给 `GET /api/settings/app-versions/latest`。这个接口不用登录，每个 IP 每分钟最多 60 次，任何失败都不提示；
- **wgt**（资源热更新包：只包含页面和脚本，不含原生代码）在 App 里下载，用 `plus.runtime.install` 安装后自动重启。安装时 `force: false`，版本不比当前高、或者属于别的 App 的包会被拒绝；
- **整包**（完整的安装包：安卓的 APK，iOS 上是 App Store 里的新版本）用 `plus.runtime.openURL` 打开下载地址：安卓用浏览器下载安装包，iOS 打开 App Store。App 里不直接安装 APK。

### 发布一个 wgt

1. 调高 `mobile/src/manifest.json` 的 `versionName`，它就是 wgt 的版本号；
2. 带上 `VITE_API_BASE` 运行 `pnpm mobile:build:app`，在 HBuilderX 里导入 `mobile/dist/build/app`，选 **发行 → 原生 App-制作移动 App 资源升级包**；
3. 把生成的 wgt 上传到一个 https 地址；
4. 在 **系统管理 → App 版本** 里新增一行，包类型选 **资源热更新包**。

改了**原生层**（新增模块或权限、升级 uni-app、HBuilderX 或 SDK）就必须发整包，之后的 wgt 要把 **最低原生版本** 填成这个整包的版本，否则旧的整包装上新的资源会出错。

整包提交应用商店审核之前，把参数 `app.update.review_version`（审核中的原生版本）设成提交的版本号，审核通过后清空。iOS 的热更新不能改变 App 的主要功能（App Store 的规则）。

::: warning 谁能发版
有 `settings.appVersion.create` 或 `settings.appVersion.modify` 权限的人，可以给所有装了 App 的手机下发代码。只把这两个权限给负责发版的人。
:::

## App 权限

**安卓**：`manifest.json` 的 `app-plus.distribute.android.permissions` 只列了代码用到的权限：

| 权限 | 用途 |
| --- | --- |
| `ACCESS_NETWORK_STATE`、`ACCESS_WIFI_STATE` | 网络状态 |
| `CAMERA`，以及 `uses-feature android.hardware.camera` | 换头像时 `uni.chooseImage` 可以拍照 |

DCloud 模板默认带的其他权限都删掉了。没有 `REQUEST_INSTALL_PACKAGES`（整包走浏览器下载），也没有 `READ_EXTERNAL_STORAGE`；在安卓 12 及以下的手机上从相册选图是否正常，还没有在真机上验证。

**iOS**：`app-plus.distribute.ios.privacyDescription` 里写了相机（`NSCameraUsageDescription`）和相册（`NSPhotoLibraryUsageDescription`）的用途说明。缺少用途说明时，iOS 调用会闪退，审核也会被拒。说明现在只有中文，英文系统的 iPhone 上也显示中文，措辞可以直接改。

单元测试 `mobile/src/__tests__/mobile-manifest.spec.ts` 会检查这两份列表。新功能要用某项原生能力时：

1. 在 `manifest.json` 里加上对应的权限或用途说明；
2. 在同一次提交里修改这个测试；
3. 在隐私政策里写明用途和什么时候申请；
4. 改了权限属于改原生层，要发整包。

## 发布清单

每次正式发布按顺序做一遍，把这一节复制到你的发布记录里逐项确认。标"首次"的只在第一次发布、换主体或换域名时做。

### 1. 发布前（小程序和 App 共用）

1. **首次**：去掉代码生成器示例页的登记。图书、知识主题、发票三个示例模块的 9 个页面登记在 `pages.json` 的 `pages-biz` 里，没有入口，但登记过的页面会随小程序和 App 一起上线：
   - 删掉 `mobile/src/pages.json` 里 `demo/book`、`demo/topic`、`demo/invoice` 下的 `index`、`detail`、`form` 共 9 条；
   - 同时删掉 `mobile/e2e/mobile-codegen.spec.ts`，它按地址打开这些页面，页面没登记就会失败；
   - 示例的源码（`mobile/src/pages-biz/demo/`、`mobile/src/api/demo/`、翻译片段）留着：`pnpm gen:check-golden` 会把它们和生成器的结果逐字比对；
2. **首次**：换成自己的应用名和标志：`mobile/src/manifest.json` 的 `name`、`pages.json` 里 `globalStyle` 的 `navigationBarTitleText`（默认标题 `Qiwu`）、`mobile/src/locales/{zh-CN,en-US}/common.json` 的 `app.name`（页面上显示的"栖梧"和 `Qiwu`）、`login.json` 的 `motto` 和 `slogan`（登录页的题字和标语）、`mine.json` 的 `intro`（"关于"页的介绍），以及标志 `mobile/src/static/brand/mark-white.svg`。英文的 `motto` 要保持为空：英文界面不显示题字，单元测试会检查这一点。App 图标和启动图见[用 HBuilderX 打包 App](#用-hbuilderx-打包-app)；
3. `pnpm ci:local` 全部通过（在前两步之后运行）；
4. 调高 `manifest.json` 的 `versionName`（比如 `1.2.0`）和 `versionCode`（只增不减的整数，比如 `120`）。App 的更新检查和小程序上传时的版本号都用 `versionName`；`versionCode` 是安卓安装和应用市场判断能否升级用的；
5. 服务端（部署见[部署](/guide/deploy)）：
   - 接口域名已经备案（中国大陆的网站要先做 ICP 备案）；HTTPS 证书支持 TLS 1.2 及以上，证书链完整（iOS 不接受自签名证书）；
   - 反向代理把 `/socket.io/` 按 WebSocket 方式转发，和电脑端相同，见[部署 · 反向代理](/guide/deploy#反向代理-nginx)；
   - `CORS_ORIGIN` 先不用为移动端改，真机核对时按需添加（见下文第 4 节的实时推送）；
   - 打开需要的功能：微信登录（`auth.wx_mp.enabled`，以及 `.env.local` 里的 `WX_MP_APPID`、`WX_MP_SECRET`）、订阅消息（`notify.wx_subscribe.*`）、App 更新（`app.update.enabled`）；
6. 构建时带上 `VITE_API_BASE`，见[构建与打包](#构建与打包)。

### 2. 微信小程序

**首次**（在微信公众平台 mp.weixin.qq.com 操作）：

1. 用企业主体注册小程序并完成小程序备案，服务类目选和实际功能一致的；
2. 把 AppID 填进 `mobile/src/manifest.json` 的 `mp-weixin.appid`，也填进服务端 `apps/server/.env.local` 的 `WX_MP_APPID`；
3. **开发管理 → 开发设置 → 服务器域名**：

   | 类型 | 填什么 |
   | --- | --- |
   | request 合法域名 | `https://<接口域名>` |
   | uploadFile 合法域名 | `https://<接口域名>`（附件和头像经后端上传） |
   | socket 合法域名 | `wss://<接口域名>`（实时推送；不配也能用，角标退回每 60 秒查询） |
   | downloadFile 合法域名 | 不用配，小程序不下载文件 |

   域名只能是已备案的 https / wss 域名，不能用 IP 或 localhost；
4. **用户隐私保护指引**（**设置 → 服务内容声明 → 用户隐私保护指引**，也可以在提交审核时填写），按代码实际调用的隐私接口声明：

   | 指引里的信息类型 | 代码里的调用 | 用途 |
   | --- | --- | --- |
   | 选中的照片或视频信息 | `uni.chooseImage`（个人资料页换头像） | 更换头像 |
   | 选中的文件 | `uni.chooseMessageFile`（`QwUpload`，附件上传） | 上传审批或单据的附件 |

   没用到的不要勾（位置、手机号按钮、摄像头组件、通讯录、剪贴板等）。账号、姓名、手机号、头像、部门、审批内容这些你自己收集的个人信息，写进指引的补充文档或隐私政策。没有在指引里声明的隐私接口会直接调用失败。微信的规则会变，以提审页面的提示为准；
5. 订阅消息（可选）：按[消息中心 · 微信订阅消息](/features/messaging#微信订阅消息)选模板、配置参数、打开开关；
6. 用 miniprogram-ci 上传的话：在 **开发管理 → 开发设置 → 小程序代码上传** 下载代码上传密钥 `private.<AppID>.key`，放在仓库外（根目录的 `.gitignore` 已经忽略 `private.*.key`），并开启 IP 白名单，只填上传机器的出口 IP。

**每次**：

1. 上传，二选一：
   - 微信开发者工具：导入 `mobile/dist/build/mp-weixin`（AppID 和 `manifest.json` 一致）→ 上传，版本号填 `versionName`，备注写这次的变更；
   - miniprogram-ci（MIT 许可）：命令见下文；
2. 在版本管理里把上传的开发版设为体验版 → 按第 4 节在真机上核对 → 提交审核 → 审核通过后发布。小程序必须登录才能用：提审时说明登录方式，并提供一个测试账号（用测试数据，不要用真实员工的账号）。

用 miniprogram-ci 上传时，不把它加进依赖，用 `npx` 临时运行，版本写死。把 AppID、版本号、说明和仓库外的密钥路径换成你自己的：

::: code-group

```bash [macOS]
npx miniprogram-ci@2.1.31 upload \
  --pp mobile/dist/build/mp-weixin \
  --pkp <仓库外的目录>/private.<AppID>.key \
  --appid <AppID> \
  --uv <versionName> --ud "<变更说明>" \
  -r 1 --enable-es6 true
```

```powershell [Windows（PowerShell）]
npx miniprogram-ci@2.1.31 upload --pp mobile/dist/build/mp-weixin --pkp "C:/keys/private.APPID.key" --appid APPID --uv 1.2.0 --ud "Release notes" -r 1 --enable-es6 true
if ($LASTEXITCODE -ne 0) { throw "Mini program upload failed" }
```

:::

`-r` 是机器人编号（1–30）。Windows 上所有参数写在一行，路径和说明加引号；中文说明在 Windows PowerShell 5.1 下的编码没有验证过，建议用英文。上传本身也没有在 Windows 上执行过。

### 3. App（安卓、iOS）

**首次**：

1. HBuilderX 5.26 登录 DCloud 账号；`manifest.json` 的 `appid` 填 DCloud 应用标识，`name` 填应用名；
2. 安卓：
   - 包名（比如 `com.example.qiwu`）在云打包时填写，上架后不能再改；
   - 签名证书二选一：DCloud 云端证书（本地不需要文件），或者自有证书（上架应用市场时推荐；证书丢了，同一个包名就再也发不了更新）。自有证书用 JDK 自带的 `keytool` 生成，macOS 和 Windows 命令相同：

     ```bash
     keytool -genkeypair -alias qiwu -keyalg RSA -keysize 2048 -validity 36500 -keystore qiwu.keystore
     ```

     证书文件和密码放在仓库外（比如密码管理器），另做备份。根目录的 `.gitignore` 已经忽略 `*.keystore`、`*.jks`；
   - 隐私政策弹窗：国内应用市场要求用户同意隐私政策之前不申请权限、不读设备信息。在 `mobile/src/`（和 `manifest.json` 同一个目录）放一个 `androidPrivacy.json`，用模板模式（`"prompt": "template"`），正文链接到隐私政策和用户协议的网页。这个文件里不能写注释，格式见 DCloud 文档"Android 平台隐私与政策提示框"；
3. iOS：
   - 用公司的 Apple 开发者账号，在开发者后台建 App ID（Bundle ID，比如 `com.example.qiwu`）；
   - 发布证书（导出成带密码的 `.p12`）和 App Store 类型的描述文件（`.mobileprovision`），云打包时上传。它们放在仓库外，`.gitignore` 已经忽略 `*.p12`、`*.mobileprovision`、`*.cer`；
   - 相机和相册的用途说明已经写好，见[App 权限](#app-权限)；
4. 隐私政策和用户协议：内容是你自己的法律文本，放在一个 https 网页上。登录页底部的 **隐私政策**、**用户协议** 现在打开的是"关于"页（`mobile/src/pages/login/index.vue` 的 `openAbout`），发布前改成打开这两个网页。权限说明照[App 权限](#app-权限)的列表写：相机（换头像、拍照上传）、网络状态，写明用途和什么时候申请；
5. 上架资料：国内安卓应用市场通常要软件著作权证书、隐私政策网址和截图；App Store 要审核备注和测试账号（同样用测试数据）。

**每次**：

1. 带上 `VITE_API_BASE` 运行 `pnpm mobile:build:app` → HBuilderX 导入 `mobile/dist/build/app` → **发行 → 原生 App-云打包**（选好证书和描述文件）；
2. 只改了页面和脚本、没动原生层的，可以只发 wgt，见[发布一个 wgt](#发布一个-wgt)；改了原生层必须发整包；
3. 整包提交商店审核前，把参数 `app.update.review_version` 设成提交的版本号，审核通过后清空。

### 4. 真机核对

设备：一台安卓手机、一台 iPhone，分别跑小程序体验版和云打包的 App（不要用 HBuilder 标准基座，它在 iOS 上写死了浅色）。每台设备浅色、深色各一遍，中文、英文各一遍，可以交叉覆盖。

外观：

- 小程序右上角的胶囊按钮和自绘的深蓝色头部（登录页、页签页面）垂直对齐，不挡内容；
- 自绘的底部页签栏：文字随语言切换，图标的浅色、深色版本正确，角标正常；
- 深色：小程序和 App 都能跟随系统；App 的 **我的 → 外观** 三个选项立即生效，重启后保持；
- 安卓：键盘弹起时登录页换成紧凑的头部，输入框不被挡住；
- iOS：刘海和底部横条处的安全区留白正确（页签栏、底部操作栏、弹层）；
- 深蓝色的页面（登录、绑定微信、页签页面）切换主题后，状态栏文字仍是白色；
- App 图标和启动图在安卓、iOS 上清晰、不变形。

功能：

- 登录：账号密码、短信、验证码（按参数 `captcha.mode`）、**记住用户名**；退出后回到登录页；
- 小程序：静默登录；没绑定时进入绑定页，绑定后再打开直接进入工作台；
- 小程序绑定在 Wi‑Fi 和移动网络（4G/5G）下各做一次。每次提交前应用先重新静默登录、取一张新的绑定票据，服务端要求提交时的 IP 和取票据时相同。如果提示"绑定已失效，请重新进入小程序后再绑定"，记下当时的网络，多半是这个网络下前后两次请求的 IP 不一样；
- 审批：待办列表、详情、通过、驳回、退回、转办等操作；发起请假和动态表单；附件上传（小程序从聊天记录选文件，App 选图片）；
- 换头像：拍照和相册各试一次。小程序第一次调用时弹出微信的隐私授权；iOS 第一次拍照时弹出系统的相机权限提示，文字是 `manifest.json` 里的用途说明。在一台安卓 12 及以下的手机上，换头像和审批附件各从相册选一次图；
- 切换语言后，各页、页签栏和系统弹窗的语言一致；
- 实时推送：在电脑端让员工提交请假，主管手机上的待办角标和消息角标在 2 秒左右各加 1（小程序、App 分别试）；切到后台再回来，能重新连接并补上计数；管理员在电脑端强制下线这个会话后，手机回到登录页并给出提示。
  - 角标要等约 60 秒才变时（轮询兜底），先查 socket 合法域名和反向代理的 WebSocket 转发；
  - 再查连接是不是因为来源被拒（`forbidden_origin`）：真机的连接可能带 `Origin` 头，它既不是本站、也不在 `CORS_ORIGIN` 里时会被拒绝。在反向代理上临时记录 `/socket.io/` 请求的 `Origin`（nginx 用 `$http_origin`），把看到的那个值原样加进 `CORS_ORIGIN`（逗号分隔，只加这一个，不要放宽），然后重启服务端。注意 `CORS_ORIGIN` 同时也决定哪些网站能凭电脑端的登录 Cookie 换新令牌；
- 订阅消息（有真实的 AppID、AppSecret 和模板时）：小程序 **我的** 页出现 **新待办微信提醒**，点击后微信弹窗申请订阅；之后给这个用户派一条新待办，微信"服务通知"里收到提醒，点开进入这条审批的详情；
- App 版本更新（安卓、iOS 各一遍）：开关关闭时没有提示；可选的 wgt 有 **稍后**，**立即更新** 后下载、安装并自动重启，重启后不再提示这个版本；强制的 wgt 没有 **稍后**，下载失败（比如断网）后再次弹出；整包在安卓上打开浏览器下载、在 iOS 上打开 App Store，强制更新时从商店或浏览器返回后再次弹出；`app.update.review_version` 等于当前原生版本时收不到 wgt；
- 小程序包体积：发布构建打印的主包不超过 2 MB（超过时构建直接失败）。

### 5. 发布记录

每次发布记一条：日期、`versionName` / `versionCode`、小程序上传的版本号、HBuilderX 版本、设备型号和系统版本、微信版本，以及上面每一项的结果和发现的问题。

## 测试与检查

| 命令 | 作用 |
| --- | --- |
| `pnpm mobile:verify` | 类型检查（`vue-tsc`，应用代码和 Node 侧各一份配置）+ 移动端依赖的许可证检查 |
| `pnpm mobile:test [文件名]` | vitest 单元测试 |
| `pnpm mobile:e2e [文件名]` | Playwright 端到端测试，跑 H5 |
| `pnpm -C mobile audit:report` | 依赖安全报告（`pnpm audit`）：DCloud 锁定的依赖带来的告警只单独列出，不算失败；其余依赖有高危或严重告警时失败。需要联网，不在 `verify` 里 |

这些命令在仓库根目录执行，macOS 和 Windows 相同。另外，根目录的 `pnpm verify` 会检查 `mobile/src` 的翻译，`pnpm ci:local` 会运行上面的前三项，以及 H5 和小程序的构建。

许可证的例外登记在 `mobile/license-exceptions.json`，只对 `mobile/` 有效：`caniuse-lite`（CC-BY-4.0）、`qrcode-terminal`（许可证写成了不标准的 `Apache 2.0`）、`z-paging` 2.8.8（npm 包里缺少许可证字段，它的仓库是 MIT，升级时要重新核对）。

### 单元测试

测试文件放在 `mobile/src/__tests__/`，文件名是 `*.spec.ts`。建议以 `mobile-` 开头，和仓库里其他测试文件不重名。它们在 Node 里运行，不加载 uni-app 的编译器；`uni` 对象由 `src/__tests__/uni-stub.ts` 模拟。适合测 `core/` 里的逻辑，比如请求的刷新和重发、计数、动态表单的规则。

### 端到端测试

`pnpm mobile:e2e` 用 Playwright 在模拟的 Pixel 7 手机上跑 H5。它会自己构建 H5 并启动预览，再启动一个后端，所以要等一会儿才开始跑用例。它用自己的一套库、Redis 库号和端口，可以和电脑端的 Playwright 同时运行：

| | 移动端 e2e | 电脑端 e2e |
| --- | --- | --- |
| 数据库 | `qiwu_mobile_e2e` | `qiwu_e2e` |
| Redis 库号 | 9 | 14 |
| 后端端口 | 3201 | 3200 |
| 页面端口 | 4175（H5 预览） | 4173 |

运行前要准备：

1. 用 MySQL 的 root 账号执行下面的 SQL（Windows 在 MySQL Workbench 里，macOS 在 `mysql -u root -p` 里），建库并授权给 `.env.local` 里的数据库账号（`qiwu`）。每次运行都会**清空重建**这个库，不要放有用的数据：

   ```sql
   CREATE DATABASE qiwu_mobile_e2e CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   GRANT ALL ON qiwu_mobile_e2e.* TO 'qiwu'@'localhost';
   GRANT ALL ON qiwu_mobile_e2e.* TO 'qiwu'@'127.0.0.1';
   ```

2. 后端用 `apps/server/.env.local`（数据库和 Redis 的账号）加上已经提交的 `.env.e2e`，再换成上表的库、库号和端口；
3. 先在仓库根目录构建，测试用的是后端的构建产物：

   ```bash
   pnpm build
   pnpm mobile:e2e
   ```

   只跑一个文件：`pnpm mobile:e2e mobile-login.spec.ts`；
4. 默认用本机安装的 Microsoft Edge（Windows 自带，macOS 要自己安装）。用别的浏览器时设置环境变量 `PW_CHANNEL`，比如 `chrome`。

::: tip 端口被占用，或者要在两个工作目录里同时运行
在 `apps/server/.env.mobile-e2e.local`（不提交到 git）里改这一份的库、库号、端口和上传目录。只能写 `DB_NAME`（必须以 `_e2e` 结尾）、`REDIS_DB`、`PORT`、`STORAGE_LOCAL_ROOT` 和 H5 预览端口 `E2E_H5_PORT`，写了别的键会直接报错。Windows 上用记事本创建：`notepad apps\server\.env.mobile-e2e.local`。新的库同样要先建好并授权。
:::

实时推送的测试（`mobile/e2e/mobile-push.spec.ts`）经 H5 预览的 `/socket.io` 转发连真实的后端，检查推送后 2 秒内刷新角标、强制下线后 2 秒内回到登录页、切到后台断开、回到前台后重连。

## 升级 uni-app

在 `mobile/` 目录里用 DCloud 的官方工具统一升级 `@dcloudio/*`，并和本机 HBuilderX 的版本对应；`vite`、`vue`、`@vue/runtime-core`、`@dcloudio/types` 跟着它要求的精确版本走。macOS 和 Windows 命令相同：

```bash
cd mobile
npx @dcloudio/uvm@latest --manager pnpm
pnpm i
cd ..
pnpm mobile:verify
pnpm mobile:build:h5
pnpm mobile:build:mp-weixin
pnpm mobile:build:app
pnpm mobile:e2e
```

- `pnpm i` 不能出现 `ERR_PNPM_IGNORED_BUILDS`，需要时修改 `mobile/pnpm-workspace.yaml` 的 `allowBuilds`；
- `mobile/pnpm-workspace.yaml` 的 `overrides` 把 `vite` 固定在 5.2.8，新版本要求的 vite 不同时，同时改这里；
- 依赖要发布满一天才能安装（`minimumReleaseAge`），刚发布的版本要等一天；
- 升级 uni-app 属于改原生层，App 要发整包。

## 只要电脑端：删除移动端

不需要手机端时，可以把移动端整个删掉。只有第一步是必须的，其余都是清理：`mobile/` 不存在时，下面列出的地方都会自动跳过，留着也没有影响。

建议先提交当前的改动，在一个新分支上删，有问题可以用 git 恢复。

**1. 删除 `mobile/` 和它的开发说明 `docs/mobile.md`：**

::: code-group

```bash [macOS]
rm -rf mobile docs/mobile.md
```

```powershell [Windows（PowerShell）]
cmd /c rmdir /s /q mobile
Remove-Item docs\mobile.md
```

:::

`README.md` 和 `docs/` 下的几篇文档有指向 `docs/mobile.md` 的链接，删掉后可以顺手去掉这些链接。

**2. 根目录 `package.json`：** 删掉 7 个 `"mobile:*"` 脚本（`mobile:install`、`mobile:verify`、`mobile:test`、`mobile:e2e`、`mobile:build:h5`、`mobile:build:mp-weixin`、`mobile:build:app`）。

**3. lint 和格式化的忽略设置：**

- `.oxlintrc.json` 的 `ignorePatterns` 里删掉 `"mobile/**"`；
- `.prettierignore` 删掉 `mobile/` 这一行和它上面的注释；
- `eslint.config.mjs` 删掉 `'mobile/**',` 这一行。

**4. 检查脚本（建议留着）：** `scripts/ci-local.mjs`、`scripts/i18n-check.mjs`、`scripts/license-check.mjs`、`scripts/originality-check.mjs` 里各有一个 `const MOBILE = …` 常量，没有 `mobile/` 时用到它的步骤自动跳过。想删的话，要把用到这个常量的代码一起删干净（比如 `ci-local.mjs` 里 6 个移动端步骤：安装、verify、单元测试、H5 构建、小程序构建、端到端测试），只删常量会让脚本报错。

**5. 代码生成器（留着）：** `apps/server/src/modules/platform/codegen/workspace.ts` 的 `export const MOBILE = …` 和 `scripts/gen-check-golden.mjs` 的 `const MOBILE = …` 不用改。没有 `mobile/` 时，生成器不生成移动端页面，**移动端页面** 开关打开也不会多出文件，一致性检查也不比对移动端文件。

**6. 架构检查（留着）：** `scripts/arch/mobile-refs.mjs` 检查主工程有没有引用 `mobile/`，和它的测试 `apps/server/test/arch/arch-mobile-refs.spec.ts` 要删一起删。这个测试文件同时也测"共享包只能导入 zod"的检查，不删也没有影响。

**7. 检查：**

```bash
pnpm i --frozen-lockfile
pnpm --filter @qiwu/shared build
pnpm verify
```

macOS 和 Windows 命令相同，一步成功后再执行下一步。根目录的 `pnpm-lock.yaml` 不会变，因为移动端从来不在根目录的锁定文件里。
