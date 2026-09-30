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
| `pnpm gen:check-golden` | 重新生成零手改模块，并和仓库代码比较 |

## 检查与测试

| 命令 | 作用 |
| --- | --- |
| `pnpm verify` | lint + 分层检查 + 类型检查 + 翻译完整性 + 原创性检查 + 许可证检查 |
| `pnpm --filter @qiwu/server test <文件名>` | 运行服务端的单个测试文件（不要加 `--`） |
| `pnpm --filter @qiwu/web test <文件名>` | 运行前端单元测试 |
| `pnpm --filter @qiwu/web e2e <文件>` | 运行 Playwright 端到端测试 |
| `pnpm ci:local` | 完整检查：锁定依赖安装、verify、构建、全部测试和覆盖率、代码生成一致性、Playwright、启动冒烟测试 |
| `pnpm smoke:boot` | 启动构建产物，确认 `/api/health` 正常后退出 |

## 其他

| 命令 | 作用 |
| --- | --- |
| `node scripts/fetch-ip2region.mjs` | 下载 IP 归属地数据，并校验 sha256 |
| `pnpm license:check` | 检查所有依赖的许可证 |
