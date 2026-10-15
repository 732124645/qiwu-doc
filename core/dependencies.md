---
title: 添加依赖和第三方模块
description: '给栖梧添加 npm 依赖的完整步骤：装到哪个包、版本要发布满一天、安装脚本的 allowBuilds 登记、许可证检查、catalog 共用版本，以及在服务端装配第三方 Nest 模块和新增环境变量。'
---

# 添加依赖和第三方模块

这一页讲怎么给项目加一个 npm 包，以及怎么把第三方的 Nest 模块接进服务端。

项目对依赖管得比较严：版本要发布满一天、安装脚本要登记、许可证要检查。规则都写在配置文件和检查脚本里，违反时安装或 `pnpm verify` 会直接失败。照着下面的步骤做，一般一次就能通过。

## 1. 装到哪个包

仓库是一个 **pnpm workspace**（工作区：一个仓库里放多个包，一起安装、互相引用）。依赖要装到**用它的那个包**里，而不是仓库根目录：

| 包 | 目录 | 装什么 |
| --- | --- | --- |
| `@qiwu/server` | `apps/server` | 服务端用的包 |
| `@qiwu/web` | `apps/web` | 电脑端前端用的包 |
| `@qiwu/shared` | `packages/shared` | 只有 `zod`，一般不加（原因见下文） |

在仓库根目录运行，用 `--filter` 指定包名。下面以服务端加 `@nestjs/event-emitter` 为例，换成你要装的包即可：

```bash
# 运行时要用的包（写进 dependencies）
pnpm --filter @qiwu/server add @nestjs/event-emitter

# 只在开发、测试、构建时用的包，加 -D（写进 devDependencies），例如类型声明
pnpm --filter @qiwu/server add -D @types/某个包
```

前端把 `@qiwu/server` 换成 `@qiwu/web`。这几条命令在 macOS 和 Windows（PowerShell）里写法一样。

几点注意：

- **不要在根目录直接 `pnpm add`。** 不加 `--filter` 时，包会被写进根目录的 `package.json`，而那里只放全仓库共用的工具（lint、格式化、提交检查）。这样服务端或前端的 `package.json` 里没有这个依赖，构建、部署和许可证检查都会漏掉它。
- **前端代码 `import` 的包必须放 `dependencies`，不能加 `-D`。** 前端最后会打包进浏览器代码，而许可证检查只看 `dependencies`。`pnpm verify` 的架构检查会找出放错的包。
- **共享包只能引用 `zod`。** `@qiwu/shared` 同时被移动端（小程序）构建，所以它的源码只允许引用 `zod` 和自己的文件，架构检查会拦住其他包。需要的功能请放到服务端或前端。
- **移动端是单独的工程。** `mobile/` 不在 workspace 里，有自己的 `package.json`、锁定文件和 pnpm 配置。给它加依赖用 `pnpm -C mobile add 包名`（`-C mobile` 表示在 `mobile` 目录里运行），检查用 `pnpm mobile:verify`。它的规则和版本限制见[移动端开发 · 一个独立的工程](/core/mobile#一个独立的工程)。

装完之后，`package.json` 和根目录的 `pnpm-lock.yaml`（锁定文件，记录每个包的确切版本）都会变化，两者要一起提交。

## 2. 版本要发布满一天

`pnpm-workspace.yaml` 里有这三行：

```yaml
# supply chain: packages must be ≥ 1 day old; strict = fail instead of silently falling back
minimumReleaseAge: 1440
minimumReleaseAgeStrict: true
minimumReleaseAgeExclude: []
```

意思是：**发布不满 1440 分钟（一天）的版本不能安装**。这是为了防**供应链投毒**：有人盗用作者账号发布带恶意代码的新版本，通常几小时内就会被发现并撤下。等一天，可以避开大部分这类事件。

**不写版本号时，不会出错。** 比如 `pnpm --filter @qiwu/server add 包名`，pnpm 会自动选择发布满一天的最新版本。

**指定了一个太新的版本时，安装失败**，报错类似这样：

```text
[ERR_PNPM_NO_MATURE_MATCHING_VERSION] 1 version does not meet the minimumReleaseAge constraint:
  @aws-sdk/client-sts@3.1152.0 was published at 2026-10-14T18:53:45.126Z, within the minimumReleaseAge cutoff (2026-10-14T01:59:45.390Z)
```

`strict`（严格）表示不会悄悄换成旧版本，而是直接报错。你有两种做法：

- **等一天**，到报错里的发布时间过了 24 小时再装；
- **换一个早一点的版本**，或者不写版本号，让 pnpm 自己挑。

依赖的依赖也受这条规则管。如果某个包要求的子依赖版本都还太新，同样会报这个错，做法也一样。

`minimumReleaseAgeExclude` 是例外名单，模板里是空的，也就是不给任何包开例外。报错信息会提示可以把包名加进这个名单，**请不要这样做**：这等于关掉了这层保护。

## 3. 安装脚本：allowBuilds

有些包在安装时要执行一段脚本（安装脚本），比如下载或编译二进制文件。安装脚本能在你的电脑上运行任何代码，所以项目默认**不执行**，每个这样的包都要在 `pnpm-workspace.yaml` 的 `allowBuilds` 里登记：

| 写法 | 意思 |
| --- | --- |
| `包名: true` | 允许执行安装脚本 |
| `包名: false` | 不执行，也不再报错 |

没有登记时，`pnpm i` 会报错：

```text
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.25.0

Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

报错里列出的就是需要登记的包。新的依赖可能自己没有安装脚本，但它的子依赖有，这时报错列出的是子依赖的名字。

**怎么选 `true` 还是 `false`：**先看这个脚本做什么（包的 `package.json` 里的 `preinstall`、`install`、`postinstall`）。

- 包离开它就不能用，比如要下载自己的二进制文件，才设 `true`；
- 只是统计、广告、可选的加速，或者包没有它也能正常工作，设 `false`。

模板里现有的登记都是 `false`，每一项上面都用注释写了原因，例如：

```yaml
allowBuilds:
  # optional native msgpack speed-up (via bullmq -> msgpackr); the install script only builds it when no
  # prebuilt binary fits, msgpackr falls back to pure JS without it; never allowed to run
  msgpackr-extract: false
```

新加的登记也照这样写一行注释：经由哪个包引入、脚本做什么、为什么允许或不允许。登记之后再运行一次 `pnpm i`，不能再出现 `ERR_PNPM_IGNORED_BUILDS`。

快速开始的[常见问题](/guide/getting-started#常见问题)里也有这一条。

## 4. 许可证检查

::: tip 这是模板自己的规则
栖梧要以 MIT 许可证开源发布，所以模板仓库对**自己**的依赖做许可证检查。你用栖梧开发自己的项目时，用什么许可证的依赖由你决定：可以修改 `scripts/license-check.mjs` 里允许的许可证，或者把根目录 `package.json` 的 `verify` 脚本里最后的 `&& pnpm license:check` 去掉。只是要自己评估所选依赖的许可证义务，比如 GPL 类许可证对你的项目分发方式的要求。保留 BPMN 设计器时，`bpmn-js` 的 bpmn.io 标志义务照样适用，见仓库的 [THIRD-PARTY-NOTICES.md](https://github.com/732124645/qiwu-vue-admin/blob/main/THIRD-PARTY-NOTICES.md)。
:::

下面说明模板默认的检查规则。用了许可证不兼容的包，模板就不能按 MIT 分发，所以模板仓库的每个依赖都要检查：

```bash
pnpm license:check
```

`pnpm verify` 里已经包含它，平时运行 `pnpm verify` 就会检查。它检查三个包的**生产依赖**（`dependencies`，包括它们的子依赖）；`mobile/` 已安装时也一起检查。`devDependencies` 不打包进产品，不在检查范围里。

**接受的许可证：**MIT、ISC、BSD-2-Clause、BSD-3-Clause、Apache-2.0、0BSD、MIT-0、BlueOak-1.0.0、CC0-1.0、Python-2.0、Unicode-3.0、Unicode-DFS-2016、Zlib、Unlicense。

**会失败的情况：**

- GPL、AGPL、LGPL 等**传染性许可证**（要求使用它的项目也用同样的许可证开源）；
- 不在上面名单里的其他许可证；
- 没有写许可证、写成 `SEE LICENSE IN …`（自定义条款）或 `UNLICENSED`（私有）；
- 双许可证（比如 `MIT OR GPL-3.0`）没有登记选用哪一个；
- **明确禁止的包**：几个许可证或使用条款不适合本项目的富文本编辑器、表单设计器、Excel 解析库、进程管理器、表达式求值库和验证码库，以及新版本改了许可证的包。完整名单见 [CONTRIBUTING.md](https://github.com/732124645/qiwu-vue-admin/blob/main/CONTRIBUTING.md) 和检查脚本 `scripts/license-check.mjs`。

失败时会逐行打印原因，格式大致如下（包名和数量只是示意）：

```text
FAIL 某个包@1.0.0  GPL-3.0  GPL-3.0 is copyleft (GPL/AGPL/LGPL)  [@qiwu/server]
license-check: <包的总数> packages, 1 violation(s)
```

以 `note` 开头的行只是提示（比如已经登记过的例外），不算失败；最后一行的 `0 violation(s)` 才表示通过。

**遇到失败怎么办：**如果你还想保持和模板一样的规则，首选换一个许可证合适的包。确实需要、而且许可证本身没有问题（比如只是写法不规范，`MIT/X11` 实际就是 MIT），可以在根目录的 `license-exceptions.json` 里登记：

| 字段 | 用途 |
| --- | --- |
| `aliases` | 许可证写法不规范，按版本把它对应到标准名称 |
| `elections` | 双许可证，登记选用哪一个（如 `jszip` 选 MIT） |
| `exceptions` / `binaryExceptions` | 经过审查、确认可以使用的特殊许可证 |
| `iconSets` | 允许使用的 `@iconify-json/*` 图标集 |

每一条都要写 `reason`（原因）。登记例外等于你替项目做了一次许可证判断，拿不准时不要登记。移动端还有自己的 `mobile/license-exceptions.json`，只对移动端生效。

另外，在提交说明或 PR 里写清楚新依赖的名称、版本、许可证和引入理由。

## 5. 共用版本：catalog

有些包被好几个包同时使用，版本必须一致，比如 `zod`（服务端、前端、共享包都用）。这类包的版本统一写在 `pnpm-workspace.yaml` 的 `catalog`（版本目录）里：

```yaml
catalog:
  typescript: ~6.0.3
  zod: ^4.6.5
  vitest: 5.0.1
  '@vitest/coverage-v8': 5.0.1
  vite: ^8.3.1
  '@vue/test-utils': ^2.5.1
  happy-dom: ^20.14.5
  '@types/node': ^22.18.0
```

各包的 `package.json` 里不写版本号，而是写 `catalog:`：

```json
"dependencies": {
  "zod": "catalog:"
}
```

**什么时候用：**

- 你要装的包**已经在 `catalog` 里**：在 `package.json` 里写 `"包名": "catalog:"`，然后运行 `pnpm i`；
- 一个包**会被两个以上的包使用**，并且版本必须相同：先把它加进 `catalog`，各处都写 `catalog:`；
- 只有一个包用：照常 `pnpm --filter … add`，不用进 `catalog`。

升级时只改 `catalog` 一处，所有包一起升级。`pnpm verify` 会检查 `typescript`、`vite`、`vitest` 等关键工具在整个仓库只有一个版本。

`pnpm-workspace.yaml` 里的 `overrides` 是另一回事：它强制替换某些**子依赖**的版本，用来修安全漏洞或许可证问题。每一项都有注释说明原因，平时不用动。

## 6. 装配第三方 Nest 模块

很多 Nest 生态的包会提供一个模块，比如 `XxxModule.forRoot(...)`，要放进某个模块的 `imports` 里才能用。

### 放在哪里

按项目的分层规则（见[模块结构与注册 · 分层](/core/module#分层-谁能依赖谁)）：

- **业务用的**：放在你的项目模块里，即 `apps/server/src/modules/<领域>/<业务>/` 下的 `xxx.module.ts`，再在 `modules/project.module.ts` 里注册这个项目模块（见[注册一个新模块](/core/module#注册一个新模块)）。绝大多数情况都属于这一种。
- **框架级的**：整个应用的基础设施（日志、数据库、缓存、队列这一类）才放进 `apps/server/src/core/`。`core` 不能引用任何业务模块。

### 读取配置：forRootAsync

第三方模块常常需要地址、密钥等配置。不要在代码里写死，也不要直接读 `process.env`，而是用 `forRootAsync`（有的包叫 `registerAsync`），在 `useFactory` 里从配置服务读取。

项目里的配置服务是 `AppConfigService`。它包装了 `@nestjs/config` 的 `ConfigService`，读出来的值已经校验过、转好了类型（数字是数字，开关是布尔值），而且全局提供，不用导入模块就能注入。

模板的日志模块就是这样接入第三方模块 `nestjs-pino` 的：

```ts
// apps/server/src/core/logger/logger.module.ts（节选）
import { LoggerModule } from 'nestjs-pino'
import { AppConfigService } from '../config/config.module.js'

export const CoreLoggerModule = LoggerModule.forRootAsync({
  inject: [AppConfigService],
  useFactory: (cfg: AppConfigService) => ({ pinoHttp: pinoHttpOptions(cfg) }),
})
```

`inject` 列出要注入的服务，它们会按顺序传给 `useFactory`；`useFactory` 返回这个模块的配置。任务队列用同样的写法接入 BullMQ，注入的是 Redis 客户端（`BullModule.forRootAsync({ inject: [REDIS], useFactory: … })`，见 `core/queue/queue.module.ts`）。

在项目模块里写法相同，只是导入路径多几层。下面是一个示意（`SomeSdkModule` 和 `SEARCH_URL` 都是假设的名字）：

```ts
// apps/server/src/modules/biz/search/search.module.ts
import { Module } from '@nestjs/common'
import { SomeSdkModule } from 'some-nest-sdk'
import { AppConfigService } from '../../../core/config/config.module.js'
import { SearchService } from './search.service.js'

@Module({
  imports: [
    SomeSdkModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({ url: cfg.get('SEARCH_URL') }),
    }),
  ],
  providers: [SearchService],
})
export class SearchModule {}
```

### 新增环境变量

`cfg.get('SEARCH_URL')` 只接受已经声明过的变量名，没声明会类型检查失败。新增一个环境变量要改三处：

**① 在校验规则里声明。** 文件是 `apps/server/src/core/config/env.schema.ts`，在 `z.object({ … })` 里加一行：

```ts
/** search service address; unset → search is off */
SEARCH_URL: z.url().optional(),
```

服务启动时会用这里的规则校验全部环境变量，缺少必填项或者值不合法，就拒绝启动。

尽量写成**可选**（`.optional()`）或者**带默认值**（`.default(…)`）。如果写成必填，所有环境（开发、测试、端到端测试）都要配上它，否则服务起不来。可选的变量没配时，像微信小程序登录那样把功能关掉就好。

**② 写进 `apps/server/.env.example`。** 这是 `.env` 的模板，新同事照着它配置。普通配置直接写一行 `SEARCH_URL=` 加注释说明。

**③ 密钥只放 `.env.local`。** 账号、密码、密钥这类值**不能**写进 `.env`，在 `.env.example` 里也只用注释说明，真实的值写进不提交的 `apps/server/.env.local`。原因和加载顺序见[环境变量](/reference/env)。

### 改完之后

```bash
pnpm verify
```

它会依次运行 lint、架构检查、类型检查、翻译检查、原创性检查和许可证检查。然后运行你改动模块相关的测试，再用 `pnpm dev` 启动看一下效果。

## 检查清单

- [ ] 用 `pnpm --filter @qiwu/server|@qiwu/web add` 装到了用它的包；开发工具加了 `-D`，前端代码引用的包没有加 `-D`
- [ ] 移动端的依赖用 `pnpm -C mobile add`，检查用 `pnpm mobile:verify`
- [ ] 版本发布满一天；没有往 `minimumReleaseAgeExclude` 里加包
- [ ] `pnpm i` 没有 `ERR_PNPM_IGNORED_BUILDS`；新登记的 `allowBuilds` 带注释
- [ ] `pnpm license:check` 通过；新登记的许可证例外写了原因
- [ ] 多个包共用、版本必须一致的依赖用了 `catalog:`
- [ ] 第三方 Nest 模块放在项目模块里，用 `forRootAsync` + `AppConfigService` 读配置
- [ ] 新环境变量加进了 `env.schema.ts` 和 `.env.example`；密钥只在 `.env.local`
- [ ] `package.json` 和 `pnpm-lock.yaml` 一起提交，提交说明写了包名、版本、许可证和理由
- [ ] `pnpm verify` 通过
