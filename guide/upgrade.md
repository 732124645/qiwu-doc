---
description: '把栖梧模板发布的新版本合并进自己的项目：哪些文件属于项目、用 git 取得新版本、常见冲突的处理、项目的平台表和全局唯一键登记在 project-tables.ts、新迁移用真实的当前时间，以及合并后的检查。'
---

# 升级模板版本

用栖梧模板建好自己的项目以后，模板还会继续发布新版本（修复问题、增加功能）。这一页讲怎样把新版本**合并**进你的项目。本页是概览，命令和细节以仓库的[升级模板版本](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/upgrade.md)为准。

两件事不要混淆：

- **合并代码**（本页）：把模板新版本的代码并进你的项目仓库；
- **升级数据库**：代码合并以后，对已有的数据库执行迁移和种子（`pnpm db:migrate` → `pnpm db:seed`），见[部署](/guide/deploy)。

## 升级到 v1.15.0

本版有新迁移，完成代码合并和检查后照常执行 `pnpm db:migrate` → `pnpm db:seed` 并重启，**不要重置数据库**。

- 迁移只新增三个可为空的列：调度日志的执行实例和事件循环最大延迟，模型提供方的并发上限；旧记录保持为空。
- 新增的环境变量（`APP_ROLE`、`DB_POOL_*`、`LOG_SLOW_REQUEST_MS` 等）默认值都不改变原有行为；默认的 `all` 角色会多一个空闲的 `scheduler-run` 队列，队列监控页能看到。
- 启动日志多一条 `.env` 与 `.env.local` 同键不同值的警告，以及一行 `effective config`；项目自己的非秘密键可以追加到 `EFFECTIVE_CONFIG_KEYS`。
- 要把后台任务拆到单独进程时，按[部署](/guide/deploy#使用-pm2-守护进程-可选)设置 `QW_PM2_WORKER_INSTANCES`；第一次开启和切回单个应用都要先 `pm2 delete` 再启动，并且至少保留一个 `all` 或 `worker` 实例，否则定时任务和队列都会停。

详细变化见 [v1.15.0 更新日志](/changelog#_1-15-0-·-2026-10-30) · [公开源码提交](https://github.com/732124645/qiwu-vue-admin/commit/a0be38c5c88d2cd5d67b2cc50ac6dc872ccd89ce)。
正式发布：[v1.15.0](https://github.com/732124645/qiwu-vue-admin/releases/tag/v1.15.0)。

## 升级到 v1.14.0

本版有新迁移，完成代码合并和检查后照常执行 `pnpm db:migrate` → `pnpm db:seed` 并重启，**不要重置数据库**。

- 迁移只新建一张租户表 `agent_tool_restriction`，存租户对工具的收紧（[租户工具限制](/features/agent#租户工具限制)）。
- 种子在技能管理页下新增两个动作“浏览工具限制 / 修改工具限制”（`agent.restriction.browse` / `agent.restriction.modify`），第一次建出时自动补进已经包含技能页的租户套餐；之后超级管理员在套餐里去掉，也不会再被补回。
- 运行中发消息：`mode: 'steer'` 是插话，当前这次工具调用一结束就送进本轮，同一步后面会问人或会写入的调用以它为说明记为拒绝；`mode: 'queue'` 在等审批时只排队，不再拒绝卡片。
- 停止接口 `POST /api/agent/threads/:id/cancel` 改为返回被撤回的排队消息（`{ queued: [...] }`），这些消息不再在停止后自动开始。
- “编辑后重发”不再分叉，改为原地回退：`GET …/rewind-preview?seq=` 与 `POST …/rewind { seq, lastSeq }`，过期的 `lastSeq` 返回 409；`POST …/revert` 保留，运行中返回会话忙，自动化、子任务和批量会话不能回退（409）。实时事件新增 `{ type: 'rewound', threadId, fromSeq }`。
- 审批卡新增 `why`；`unreviewed` 与 `blocked.reason` 新增 `tenant`，`blocked.reason` 新增 `list`（原来记为 `policy` 的“不在技能 / 方案清单里”）。`GET …/status` 新增模式、仍有效的放行、每轮上限、配置方案、实际上下文和按工具的原因。自己调用这些接口的前端或脚本须同步修改。

详细变化见 [v1.14.0 更新日志](/changelog#_1-14-0-·-2026-10-29) · [公开源码提交](https://github.com/732124645/qiwu-vue-admin/commit/dc00fc39857fa69630bdf8037a6083de1a6d0eb1)。
正式发布：[v1.14.0](https://github.com/732124645/qiwu-vue-admin/releases/tag/v1.14.0)。

## 升级到 v1.13.0

本版有新迁移，完成代码合并和检查后照常执行 `pnpm db:migrate` → `pnpm db:seed` 并重启，**不要重置数据库**。

- 智能助手的会话改为一个模式（只读 / 计划 / 每次询问 / 自动审查）：原来打开计划开关的会话变成“计划”模式；“信任本会话”并入“每次询问”，按单条记录记下的信任一并清空；平台参数 `agent.trust_mode` 删除。
- 工具策略改为 `auto` / `ask` / `human` / `deny`：原来的 `review` 并入 `ask`。此后会话选“自动审查”时，所有需确认的写入都先交审查模型，不再需要逐个工具开启。
- 开放自动审查之前，超级管理员在 **智能体设置 → 工具审批** 逐个复核写入工具，把删除、批量修改、对外发送和涉及金额的设为“仅人工确认”（`human`）；项目自己的这类工具可在 `@McpTool` 上声明 `highRisk: true`，恢复默认时即为仅人工确认。
- 接口层面，会话的 `planMode` 字段与 `trust` 模式值已移除；审批卡的“本会话内同意”改为本会话内不再询问这个工具（外部 MCP 工具不提供）。自己调用这些接口的前端或脚本须同步修改。

详细变化见 [v1.13.0 更新日志](/changelog#_1-13-0-·-2026-10-28) · [公开源码提交](https://github.com/732124645/qiwu-vue-admin/commit/4d0a6393596e0612d9caaa63807a48d9f3839bdd)。
正式发布：[v1.13.0](https://github.com/732124645/qiwu-vue-admin/releases/tag/v1.13.0)。

## 升级到 v1.12.0

本版没有新迁移，完成代码合并和检查后照常执行 `pnpm db:migrate` → `pnpm db:seed` 并重启，**不要重置数据库**。

- v1.11.0 升级后，没配积分费率的模型会被拒绝调用；v1.12.0 起这些模型恢复可用，调用记为未计价，不计积分也不受积分额度限制。需要积分额度的模型，再在 **智能体设置 → 模型服务** 配费率，并设置预算。
- 配了费率的模型总会计积分：用量未知时按请求与已输出内容估算，缺缓存细分或总数对不上时保守计价，都计入额度。
- 开发服务改为编译到独立的 `dist-dev/` 目录，由旧模板派生的项目要把它加入 `.gitignore`。
- 助手聊天改为桌面工作区，列表与侧栏宽度按用户和浏览器保存，不涉及数据迁移。

详细变化见 [v1.12.0 更新日志](/changelog#_1-12-0-·-2026-10-27) · [公开源码提交](https://github.com/732124645/qiwu-vue-admin/commit/c52c361f2ca14336c97a1e3c3fdec85ed4430ea5)。
正式发布：[v1.12.0](https://github.com/732124645/qiwu-vue-admin/releases/tag/v1.12.0)。

## 升级到 v1.11.0

这次升级新增助手调用积分账本及参数、菜单种子。先完成代码合并和检查，并按下述首次升级要求处理旧任务，再在已有业务库执行 `pnpm db:migrate` → `pnpm db:seed` 并重启，**不要重置数据库**。

- 旧模型须在 **智能体设置 → 模型** 中补齐普通输入、输出、缓存读取与缓存写入的积分费率，未配置时拒绝发请求。预算分别为每轮、用户每日与租户每日，`0` 不限额；旧 Token 限额不会自动转换。
- 计量和费率快照按调用留存，调价不改历史。旧数据缺失的字段保持未知，不补造积分。预算按已发生消费在下一次调用前检查，在途请求可能越过阈值。
- 聊天入口移到业务页面右侧悬浮按钮，旧通知、分享和会话链接保留；初始化后不再占侧栏聊天菜单。
- 发版前保留原数据库、Redis 和 `APP_SECRET`。首次从旧版升级时，在维护窗口停止发起新任务，先等待旧任务自然结束，再开启 `agent.paused` 并停止全部旧 worker、迁移和启动新版。`agent.paused` 是急停，会中断进行中的轮次；若必须提前急停，须人工确认原操作已结束，并核对业务结果和上游费用，不能把它当作仅停止接收新任务的开关。旧版未保存的回复片段与调用起点不能事后补造，恢复保障仅适用于新版保存的后续任务。后续发版也要先排空或停止全部旧 worker，再启动新版；混跑旧 worker 或回滚到不理解恢复检查的旧标签，不能作为恢复方案。正常关闭会有界等待在途工作、取消未完成调用并落盘；强制终止则在租约到期后接管，等待受队列和租约影响。静态资源沿用现有部署策略保留旧版文件，不承诺无缝恢复或固定秒数。
- 确认新版全部实例已启动、模型费率和预算已配置，且旧任务结果已核对后，由 root 将 `agent.paused` 恢复为 `false`，再开放新任务。解除急停不会清除各会话的恢复标记，仍须会话本人核对处理。
- 新前端发送回执丢失时只查询，不自动重发；明确重试复用原标识。重启可补齐已保存文字并恢复任务，不能续传原上游 Token 连接，当前步骤可能重新生成。浏览器只存隔离的发送标识，不存正文，整页刷新不保证保留未发送草稿。写入或图片生成结果未知时先本人核对，仍在执行的本地工作不能解除暂停；远程非幂等操作须到对方核对。确认只解除后续操作，旧轮次和队列不重放；受影响自动化需重新配置与授权。详见[断线、刷新与发版](/features/agent#断线、刷新与发版)。
- 当前公开组合保留基础申请与现有审批，不包含 v1.10.0 曾公开的原生考勤和 OA 助手代申请。已使用它们的项目先核对自己的版本、代码和迁移依赖，保留备份与旧标签；不要删除历史迁移执行记录、直接清表或用 `db:reset` 消除差异。

详细变化见 [v1.11.0 更新日志](/changelog#_1-11-0-·-2026-10-27) · [公开源码提交](https://github.com/732124645/qiwu-vue-admin/commit/c83de79468f4aafc5559070365a6f8ee7abeac79)。
正式发布：[v1.11.0](https://github.com/732124645/qiwu-vue-admin/releases/tag/v1.11.0)。

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
