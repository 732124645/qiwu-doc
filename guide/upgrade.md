---
description: '把栖梧模板发布的新版本合并进自己的项目：哪些文件属于项目、用 git 取得新版本、常见冲突的处理、项目的平台表和全局唯一键登记在 project-tables.ts、新迁移用真实的当前时间，以及合并后的检查。'
---

# 升级模板版本

用栖梧模板建好自己的项目以后，模板还会继续发布新版本（修复问题、增加功能）。这一页讲怎样把新版本**合并**进你的项目。本页是概览，命令和细节以仓库的[升级模板版本](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/upgrade.md)为准。

两件事不要混淆：

- **合并代码**（本页）：把模板新版本的代码并进你的项目仓库；
- **升级数据库**：代码合并以后，对已有的数据库执行迁移和种子（`pnpm db:migrate` → `pnpm db:seed`），见[部署](/guide/deploy)。

## 先少改模板的文件

升级时冲突多不多，取决于你的项目改了多少模板的文件。项目自己的代码和登记，尽量只写在项目自己的文件里：

| 归属 | 文件 |
| --- | --- |
| 项目 | 项目域目录（`apps/server/src/modules/<域>/`、`apps/web/src/views/<域>/`、`apps/web/src/api/<域>/`、`packages/shared/src/<域>/`）、`modules/project.module.ts`、`db/seeds/project/*`、`db/project-tables.ts`、项目自己的迁移、`.env*` 配置 |
| 模板 | `apps/server/src/core/`、`modules/platform/`、`modules/workflow/`，`apps/web/src/core/`、`views/platform/`、`views/workflow/`，`packages/shared` 的平台与公共部分，`core/db/tenant-tables.ts`，模板发布过的迁移，`scripts/`，模板的测试和文档 |
| 两边都改 | 语言包 JSON、`db/seeds/index.ts`（`SEEDS.project` 的登记）、各个 `package.json`、`pnpm-lock.yaml` |

模板里的 `biz`、`demo` 是示例项目域，可以修改或删除，删改过以后升级时按项目文件处理。确实要改模板文件时，改动尽量小而集中，并在提交说明里写清原因，升级时更容易认出来。见仓库的[哪些文件属于谁](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/upgrade.md#1-哪些文件属于谁)。

### 项目的平台表和全局唯一键

开启[多租户](/features/multi-tenancy)时，新建的表默认是**租户表**（带 `tenant_id`，数据按租户隔离），不需要登记。只有两种情况要登记：

- **平台表**：由平台统一维护、所有租户共用的表；
- **全局唯一键**：必须在所有租户之间都不重复的唯一键，同时写明占用的值怎样释放（`none`、`row-delete`、`takeover`）。

项目的这两类登记写在项目自己的文件 `apps/server/src/db/project-tables.ts` 里（`PROJECT_PLATFORM_TABLES`、`PROJECT_GLOBAL_UNIQUE`），**不要改**模板的 `apps/server/src/core/db/tenant-tables.ts`。模板发布时这个项目文件是空的，升级也不会改它，所以这里不会冲突。规则见[编写租户感知的代码](/core/tenancy)和仓库的[项目自己的表、迁移与模板升级](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/new-project.md#7-项目自己的表迁移与模板升级)。

### 迁移的时间戳

迁移文件名是 `<14 位时间戳>-<名称>.ts`，类名以同一个时间戳结尾，比如 `20261020153817-crm-order.ts` 里的 `CrmOrder20261020153817`。

- 时间戳用**创建迁移时真实的当前时间，精确到秒**，不要用整点或整分。模板自己的迁移也在同一个目录里，整点时间容易和模板以后发布的迁移撞上；
- 每个时间戳必须唯一。`pnpm verify` 会检查，遇到重复的时间戳或者不是 14 位的文件名就报错。

## 取得新版本

模板的公开仓库是 [732124645/qiwu-vue-admin](https://github.com/732124645/qiwu-vue-admin)，每个版本有一个标签（比如 `v1.6.0`）。在项目仓库里加一次远端（叫 `upstream`），以后每次升级只需要取标签：

::: code-group

```bash [macOS]
git remote add upstream https://github.com/732124645/qiwu-vue-admin.git   # 只需执行一次
git fetch upstream --tags
git tag --list 'v*' --sort=-v:refname | head
```

```powershell [Windows（PowerShell）]
git remote add upstream https://github.com/732124645/qiwu-vue-admin.git   # 只需执行一次
git fetch upstream --tags
git tag --list "v*" --sort=-v:refname | Select-Object -First 10
```

:::

先在一个新分支上合并，确认没问题再并回主分支：

```bash
git switch -c upgrade-v1.6.0
git merge v1.6.0
```

合并前先读一遍[更新日志](/changelog)，留意不兼容的变化和新的环境变量。想要线性历史时，也可以把项目的提交变基到新标签上（`git rebase v1.6.0`）；但已经推送、多人共用的分支请用合并，不要变基。见仓库的[取得模板的新版本](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/upgrade.md#2-取得模板的新版本)。

## 常见冲突

- **项目文件**（`project.module.ts`、`seeds/project/*`、`project-tables.ts`）：保留项目的登记，再看模板那边改了什么（比如新增的示例模块），决定要不要一起保留；
- **`db/seeds/index.ts`**：模板会在这里加平台种子，项目只在 `SEEDS.project` 里登记自己的种子。两边的条目都保留，顺序以模板的注释为准；
- **语言包 JSON**：两边各自新增的键都保留，注意 JSON 的逗号和括号；同一个键两边都改过时，以项目的文案为准。合并后运行 `pnpm i18n:check`，它会报出只在一种语言里有的键；
- **迁移**：迁移文件各自独立，一般不冲突。模板发布过的迁移不要修改或改名，已安装的数据库按名字记录它。项目迁移和模板迁移时间戳相同时，`pnpm verify` 会报出这两个文件：改项目自己的那个（文件名和类名换成当前时间）；如果它已经在某些数据库上执行过，还要在这些库里把执行记录改成新名字，做法见仓库；
- **执行顺序**：已有的数据库只执行还没执行过的迁移，按时间戳先后。项目迁移如果要用到模板新版本改过的表结构，它的时间戳必须晚于对应的模板迁移；
- **`package.json` 和 `pnpm-lock.yaml`**：先按两边的依赖合并 `package.json`；锁文件不要手工合并，取模板那一侧，再执行 `pnpm i` 重新生成；
- **模板的测试**：迁移测试从迁移目录读取清单、按规则检查每张表，项目新增的表和迁移不需要改模板的测试。

见仓库的[常见冲突与处理](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/upgrade.md#3-常见冲突与处理)。

## 合并后的检查

在仓库根目录依次执行：

```bash
pnpm i
pnpm --filter @qiwu/shared build
pnpm ai:map
pnpm verify
pnpm --filter @qiwu/server build
pnpm --filter @qiwu/server test
```

最后做一次完整检查，它会清空重建测试库：

::: code-group

```bash [macOS]
pnpm ci:local
```

```powershell [Windows（PowerShell）]
pnpm ci:local --serial
```

:::

- 合并后运行 `pnpm ai:map` 重新生成[项目地图](/guide/ai#项目地图) `docs/ai/project-map.md` 并提交：模板和项目两边的改动都会让它过期，`pnpm verify` 会检查它；这个文件有冲突时也不要手工解决，直接重新生成；
- 本地反复调试服务端测试时，可以用快速模式 `QW_TEST_REUSE_DB=1`（见[后端测试 · 加快测试](/backend/testing#加快测试)），但升级是否成功，以完整重建测试库的那次运行为准；
- 开发库用 `pnpm db:migrate` 和 `pnpm db:seed` 升级，**不要**对已有的库执行 `pnpm db:reset`（它会清空数据）；
- 生产环境先备份数据库，再按[部署](/guide/deploy)的步骤执行迁移和种子。

新版本带来的可选模块由开关控制，默认关闭，比如[微信公众号](/features/wxoa)（`APP_WXOA`）和 [MCP 智能体接入](/features/mcp)（`APP_MCP`）。升级后它们保持关闭，数据表照常由迁移创建；需要时在 `.env` 里打开开关，再重启全部实例。见仓库的[合并后的检查](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/upgrade.md#4-合并后的检查)。
