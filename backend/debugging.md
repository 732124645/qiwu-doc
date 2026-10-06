---
description: '后端排查问题：用 traceId 对照日志、用 Swagger 绕开前端调接口、直接查数据库，以及 404、403、400、依赖注入失败、pnpm verify 不通过的常见原因。'
---

# 排查问题

## 先看 traceId

每个请求都有一个编号 `traceId`。出错时，它会出现在：

- 接口返回的错误信息里：`{ "code": "…", "msg": "…", "traceId": "6f1c…" }`；
- 响应头 `X-Request-Id` 里；
- 服务端的每一行日志里（字段名是 `reqId`）。

所以排查问题的第一步是：**在浏览器开发者工具的 Network 面板里找到出错的请求，复制 traceId，然后到服务端日志里搜索它。** 这样就能看到这个请求在服务端经历的所有事情。

## 看日志

`pnpm dev` 运行时，服务端的日志直接输出在终端里。日志是结构化的 JSON（开发环境下会格式化得更易读）。

想看更多细节，可以在 `apps/server/.env` 里调低日志级别：

```ini
LOG_LEVEL=debug
```

::: tip 日志会自动脱敏
密码、令牌、验证码等敏感字段，在日志和操作日志里都会被自动替换成 `***`，不用担心泄露。
:::

## 用 Swagger 直接调接口

打开 `http://localhost:5173/api/docs`（需要 `SWAGGER_ENABLED=true`），可以看到所有接口、参数和返回格式，还可以直接调用：

1. 在前端登录后，打开开发者工具，从任意一个请求的请求头里复制 `Authorization` 的值；
2. 在 Swagger 页面点击右上角的 **Authorize**，粘贴令牌（不带 `Bearer ` 前缀）；
3. 选择一个接口，点 **Try it out**。

这样可以绕开前端，确认问题到底出在前端还是后端。

## 查看数据库

推荐用图形化的数据库客户端（比如 DBeaver、TablePlus、DataGrip），连接到 `qiwu_dev` 库直接查看表里的数据。Windows 用 **MySQL Workbench**，连接时填 `127.0.0.1`、端口 `3306`、用户名 `qiwu` 和 `.env.local` 里的数据库密码，选中 `qiwu_dev`，在查询窗口执行下面的 SQL。Windows 默认没有把 `mysql` 加入 PATH，不需要在 PowerShell 中运行它。

macOS 也可以用命令行登录（提示输入密码后，应看到 `mysql>`）；Windows 在 Workbench 的查询窗口选中数据库：

::: code-group

```bash [macOS]
mysql -u qiwu -p qiwu_dev
```

```sql [Windows（MySQL Workbench）]
USE qiwu_dev;
```

:::

下面的 SQL 在 macOS 的 `mysql>` 提示符后输入，或在 Windows 的 Workbench 查询窗口里执行。你应该看到表名、表结构和查询结果。

```sql
SHOW TABLES;
DESCRIBE crm_customer;                                            -- 查看表结构
SELECT * FROM crm_customer ORDER BY id DESC LIMIT 10;             -- 最新的 10 条
SELECT * FROM meta_migrations ORDER BY id DESC LIMIT 5;           -- 最近执行的迁移
```

::: warning
手动修改数据只用于排查问题，并且只能在开发库上进行。表结构的修改一律写迁移。
:::

## 后台自带的排查工具

| 页面 | 能看到什么 |
| --- | --- |
| 系统管理 → 日志管理 → 操作日志 | 谁、什么时候、调用了哪个接口、参数是什么、成功还是失败 |
| 系统管理 → 日志管理 → API 错误日志 | 所有 500 错误的异常信息和堆栈 |
| 系统管理 → 日志管理 → API 访问日志 | 请求记录（默认只记录非 GET 请求，要记录全部请求，在参数设置中把 `audit.http_trace.mode` 改为 `all`） |
| 系统管理 → 日志管理 → 登录日志 | 登录成功、失败、被锁定的记录 |
| 系统监控 → 缓存列表 | Redis 里的数据 |
| 系统工具 → 系统接口 | Swagger 接口文档 |

## 常见问题

**接口返回 404，但代码明明写了**

- 新模块没有注册到 `project.module.ts` 的 `imports` 里；
- 路径写错了：控制器的 `@Controller('biz/customers')` 前面会自动加上 `/api`；
- 固定路径写在了 `:id` 路由的后面，被 `:id` 抢先匹配了；
- 这条记录不在你的数据范围内。这是项目的设计：超出范围一律返回 404。

**返回 403**

当前用户没有这个接口需要的权限。检查控制器上 `@RequirePerm` 写的是什么，再检查角色有没有勾选这个权限。新加的权限需要先执行 `pnpm db:seed`，才会出现在菜单授权树里。

**返回 400**

参数没有通过 zod 校验。返回的 `errors` 数组会列出每个出错的字段。常见原因：前端传了字符串，schema 要求的是数字；或者必填字段没有传。

**改了共享包，但服务端没有生效**

服务端读取的是共享包**编译后**的产物。`pnpm dev` 会自动重新编译；如果没有运行 `pnpm dev`，要手动执行 `pnpm --filter @qiwu/shared build`。

**`Nest can't resolve dependencies of the XxxService`**

依赖注入失败，常见原因：

- 要注入的服务没有写在当前模块的 `providers` 里，或者所在的模块没有被 `imports`；
- 对方模块没有在 `exports` 里导出这个服务；
- 构造函数参数的类型是用 `import type` 导入的，运行时类型信息丢失了。改成普通的 `import`。

**`Cannot find module './xxx'`**

相对路径导入漏写了 `.js` 后缀。ESM 项目里必须写成 `'./xxx.js'`。

**迁移执行报错**

先看报错的 SQL。如果迁移执行了一半就失败了，可能需要手动把表结构恢复原状，再修改迁移重新执行。开发库也可以直接用 `pnpm db:reset` 重建。

**`pnpm verify` 不通过**

看它输出的是哪一项检查：

| 检查 | 常见原因 |
| --- | --- |
| lint | 代码风格；跨层导入（比如 platform 导入了 biz） |
| arch | 非 GET 接口缺少 `@ActionLog`；带数据范围的修改接口没有用 `lockScopedIds`；拼接了 SQL 字符串；直接写了 Redis 键；`scripts/` 里的脚本直接用 `spawn('pnpm', …)` 这类在 Windows 上跑不通的写法启动命令。构建过前端时还会扫描 `apps/web/dist`：出现白名单以外的 `eval` / `Function` 调用或 wangeditor v4 的代码，通常是新加的依赖带进来的 |
| typecheck | 类型错误 |
| i18n | 缺少某种语言的翻译；代码里写了中文 |
| originality | 使用了参考项目里的标识符 |
| license | 新依赖的许可证不在白名单里 |
