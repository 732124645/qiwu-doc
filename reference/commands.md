# 命令

在仓库根目录执行。

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
| `pnpm gen write <表...>` | 写入仓库（需要 `CODEGEN_WRITE=true`） |
| `pnpm gen:check-golden` | 重新生成零手改模块，并和仓库代码比较。模板升级后用 `pnpm gen:check-golden 2>/dev/null \| git apply` 把差异应用到仓库 |

## 检查与测试

| 命令 | 作用 |
| --- | --- |
| `pnpm verify` | lint + 架构检查（分层、SQL 拼接、操作日志、Redis 键、`eval` 等，构建过前端时还会扫描构建产物）+ 类型检查 + 翻译完整性 + 原创性检查 + 许可证检查 |
| `pnpm --filter @qiwu/server test <文件名>` | 运行服务端的单个测试文件（不要加 `--`） |
| `pnpm --filter @qiwu/web test <文件名>` | 运行前端单元测试 |
| `pnpm --filter @qiwu/web e2e <文件>` | 运行 Playwright 端到端测试 |
| `pnpm ci:local` | 完整检查：锁定依赖安装、verify、构建、前端构建产物扫描、前端开发模式冒烟测试、全部测试和覆盖率、移动端检查和构建、代码生成一致性、Playwright、移动端端到端测试、启动冒烟测试 |
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
