---
description: '仓库根目录的 pnpm 命令速查：日常开发、数据库迁移与种子、代码生成及一致性检查、verify 和 ci:local 等检查与测试命令。'
---

# 命令

在仓库根目录执行。Windows 上在 Windows PowerShell 5.1 里执行同样的命令；没有放开脚本执行策略时，把 `pnpm` 写成 `pnpm.cmd`（见[仓库入门指南](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/getting-started.md#windows原生-powershell-51)）。开发和完整检查（`pnpm ci:local --serial`）已在 Windows 11 上验证，Windows 服务器部署和 App、小程序发布还没有验证。环境安装见[安装环境（Windows）](/beginner/install-windows)。

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

模板升级后先 `--write` 同步零手改模块，再不带参数运行一次确认没有差异：

```bash
pnpm gen:check-golden --write
pnpm gen:check-golden
```

这条命令会重置隔离的测试库（`qiwu_test` + Redis 15），目标文件有未提交的改动时拒绝写入，见[仓库代码生成文档](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/codegen.md#g0-与检查边界)。

## 检查与测试

| 命令 | 作用 |
| --- | --- |
| `pnpm verify` | lint + 架构检查（分层、SQL 拼接、操作日志、Redis 键、`eval` 等，构建过前端时还会扫描构建产物）+ 类型检查 + 翻译完整性 + 原创性检查 + 许可证检查。刚克隆的仓库要先执行一次 `pnpm --filter @qiwu/shared build` |
| `pnpm --filter @qiwu/server test <文件名>` | 运行服务端的单个测试文件（不要加 `--`） |
| `pnpm --filter @qiwu/web test <文件名>` | 运行前端单元测试 |
| `pnpm --filter @qiwu/web e2e <文件>` | 运行 Playwright 端到端测试 |
| `pnpm ci:local` | 完整本地检查：安装、verify、构建、全部测试、Playwright、移动端和冒烟测试；会重置测试库，先按[仓库入门指南第 5 节](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/getting-started.md#5-检查与后续使用)准备；Windows 用 `pnpm ci:local --serial` |
| `pnpm mobile:<命令>` | 在 `mobile/` 目录运行移动端命令：`verify`、`test`、`e2e`、`build:h5`、`build:mp-weixin`、`build:app` |
| `pnpm smoke:boot` | 启动构建产物，确认 `/api/health` 正常后退出 |
| `pnpm smoke:web-dev` | 前端开发模式冒烟测试：启动 Vite 开发服务器，在本机 Edge 中加载全部页面模块，不需要后端。Playwright 测的是构建产物，这条命令专门找只在 `pnpm dev` 下出现的问题 |

提交 PR 前要跑的检查见[贡献指南](https://github.com/732124645/qiwu-vue-admin/blob/main/CONTRIBUTING.md#提交-pr-之前)。

## 其他

| 命令 | 作用 |
| --- | --- |
| `node scripts/fetch-ip2region.mjs` | 下载 IP 归属地数据，并校验 sha256 |
| `pnpm license:check` | 检查所有依赖的许可证 |
| `node scripts/new-project.mjs` | 新项目初始化脚本：给基于模板的新项目配置数据库名、Redis 库号、密钥和系统名称，用法见[快速开始 · 创建自己的项目](/guide/getting-started#创建自己的项目)；权威用法见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/new-project.md) |
