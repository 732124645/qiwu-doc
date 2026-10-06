---
description: '仓库根目录的 pnpm 命令速查：日常开发、数据库迁移与种子、代码生成及一致性检查、verify 和 ci:local 等检查与测试命令，以及在 Windows 上的验证情况。'
---

# 命令

在仓库根目录执行。Windows 上，在自带的 Windows PowerShell 5.1 中执行同样的 `pnpm` 命令即可：安装依赖、启动开发、数据库命令、检查、测试和 `pnpm ci:local` 都已在 Windows 11 上验证过；移动端 App 的打包和发布、新项目脚本的完整演练还没有在 Windows 上验证。环境安装、脚本执行策略和验证范围见[安装环境（Windows）](/beginner/install-windows)。

## 日常开发

| 命令 | 作用 |
| --- | --- |
| `pnpm i` | 安装依赖 |
| `pnpm dev` | 同时启动共享包编译、服务端（3000）和前端（5173） |
| `pnpm build` | 构建全部包 |
| `pnpm format` | 用 Prettier 格式化代码 |

## 数据库

| 命令 | 作用 |
| --- | --- |
| `pnpm db:migrate` | 执行尚未执行的迁移 |
| `pnpm db:seed` | 写入或补齐种子数据（可以重复执行） |
| `pnpm db:reset` | **清空**数据库 → 迁移 → 种子（只能用于 `_dev` / `_test` / `_e2e` 库） |

## 代码生成

| 命令 | 作用 |
| --- | --- |
| `pnpm gen import <表...>` | 导入表，保存默认配置 |
| `pnpm gen render <表...> [--out <目录>]` | 打印生成结果，或者输出到仓库外的目录 |
| `pnpm gen write <表...>` | 写入仓库（需要 `NODE_ENV=development` 且 `CODEGEN_WRITE=true`）；已有文件内容不同时只输出差异，整批都不写 |
| `pnpm gen:check-golden` | 重新生成零手改模块，和仓库代码逐字比较，有差异时以非零状态退出；加 `--write` 把新的生成结果写进仓库 |

### 模板升级后比较生成结果

升级生成器模板后，先用 `--write` 把零手改模块更新成新的生成结果，再运行一次默认检查确认没有差异（macOS 和 Windows 命令相同）：

```bash
pnpm gen:check-golden --write
pnpm gen:check-golden
```

第二条命令正常结束、没有输出差异，就说明仓库里的生成物和模板一致。然后用 `git diff` 查看具体改了哪些文件。

::: warning 先确认数据和改动
`gen:check-golden` 会先构建服务端，再**重置**测试数据库（`.env.test` 配置的库，默认 `qiwu_test` + Redis 15 号库；为防止误删，它只接受模板登记过的测试库和库号组合），所以执行前要确认测试配置，并且不要和其他测试同时运行。`--write` 只改零手改模块的文件；目标文件有未提交的改动时，它会拒绝写入，所以先提交或保存当前改动。不要手动修改这些生成物，应该改模板或生成配置后再用这条命令同步。
:::

## 检查与测试

| 命令 | 作用 |
| --- | --- |
| `pnpm verify` | lint + 架构检查（分层、SQL 拼接、操作日志、Redis 键、`eval` 等，构建过前端时还会扫描构建产物）+ 类型检查 + 翻译完整性 + 原创性检查 + 许可证检查。刚克隆的仓库要先执行一次 `pnpm --filter @qiwu/shared build` |
| `pnpm --filter @qiwu/server test <文件名>` | 运行服务端的单个测试文件（不要加 `--`） |
| `pnpm --filter @qiwu/web test <文件名>` | 运行前端单元测试 |
| `pnpm --filter @qiwu/web e2e <文件>` | 运行 Playwright 端到端测试 |
| `pnpm ci:local` | 完整检查：锁定依赖安装、verify、构建、前端构建产物扫描、前端开发模式冒烟测试、全部测试和覆盖率、移动端检查和构建、代码生成一致性、Playwright、移动端端到端测试、启动冒烟测试。默认逐步串行执行；Windows 上只能串行，加 `--parallel` 会被拒绝 |
| `pnpm mobile:<命令>` | 在 `mobile/` 目录运行移动端命令：`verify`、`test`、`e2e`、`build:h5`、`build:mp-weixin`、`build:app` |
| `pnpm smoke:boot` | 启动构建产物，确认 `/api/health` 正常后退出 |
| `pnpm smoke:web-dev` | 前端开发模式冒烟测试：用全新的临时依赖缓存启动 Vite 开发服务器（不需要后端），在本机 Edge 中加载 `apps/web/src` 下的全部 `.vue` 模块和源码中按需导入的包，再打开表单设计器，确认它能正常显示；最多 240 秒 |

::: tip 为什么要有开发模式冒烟测试
Playwright 测的是构建产物，有些问题只在 `pnpm dev` 下出现，比如某个依赖在开发模式下加载失败、表单设计器的组件没有注册。`pnpm smoke:web-dev` 专门检查这些，`pnpm ci:local` 在构建之后运行它。用别的浏览器时，设置环境变量 `PW_CHANNEL`。
:::

## 其他

| 命令 | 作用 |
| --- | --- |
| `node scripts/fetch-ip2region.mjs` | 下载 IP 归属地数据，并校验 sha256 |
| `pnpm license:check` | 检查所有依赖的许可证 |
| `node scripts/new-project.mjs` | 新项目初始化脚本：给基于模板的新项目配置数据库名、Redis 库号、密钥和系统名称，用法见[快速开始 · 创建自己的项目](/guide/getting-started#创建自己的项目) |
