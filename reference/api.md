# API 约定

## 路径

- 前缀：`/api`，按域划分：`/api/iam/*`、`/api/settings/*`、`/api/messaging/*`、`/api/audit/*`、`/api/storage/*`、`/api/scheduler/*`、`/api/codegen/*`、`/api/monitor/*`、`/api/geo/*`、`/api/oauth/*`（客户端管理）、`/api/wf/*`；项目领域是 `/api/<领域>/*`，比如 `/api/biz/*`、`/api/demo/*`、`/api/crm/*`
- 认证：`/api/auth/*`；OAuth2 提供方：`/api/oauth2/*`（见下面的[例外：OAuth2 接口](#例外-oauth2-接口)）
- 资源名用复数、短横线连接：`/api/iam/users`、`/api/settings/dict-entries`

## 标准增删改查

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/users` | 分页列表 |
| `GET` | `/users/:id` | 详情 |
| `POST` | `/users` | 新增 |
| `PUT` | `/users/:id` | 修改 |
| `DELETE` | `/users/:id` | 删除 |
| `POST` | `/users/batch-delete` | 批量删除，请求体 `{ ids }` |
| `GET` | `/users/options` | 下拉选项 |
| `GET` | `/users/export` | 导出 xlsx |
| `GET` | `/users/import-template` | 下载导入模板 |
| `POST` | `/users/import` | 导入（multipart，`mode=insert\|upsert`） |

动作写成子资源：`PUT /users/:id/enabled`、`PUT /users/:id/password`、`PUT /roles/:id/menus`。

## 分页查询参数

| 参数 | 说明 |
| --- | --- |
| `page` | 从 1 开始 |
| `pageSize` | 默认 20，最大 200 |
| `sort` | 如 `createdAt,-id`（`-` 表示倒序），可排序的字段由 schema 白名单限定 |
| `<字段>From` / `<字段>To` | 范围查询 |

## 响应格式

成功：

```json
{ "code": 0, "msg": "ok", "data": { } }
```

分页时 `data` 为：

```json
{ "items": [], "total": 0 }
```

失败：

```json
{
  "code": "B1001",
  "msg": "用户名已存在",
  "data": null,
  "errors": [{ "path": "username", "msg": "…" }],
  "traceId": "6f1c…"
}
```

`msg` 已按请求语言翻译好，前端直接显示即可。`traceId` 与服务端日志对应，方便排查问题。

### 例外：OAuth2 接口

给第三方后端调用的三个 OAuth2 接口遵守 OAuth2 的标准（RFC 6749、7662、7009），不用上面的约定：

| 接口 | 请求体 | 成功 | 失败 |
| --- | --- | --- | --- |
| `POST /api/oauth2/token` | `application/x-www-form-urlencoded` | 标准 JSON：`{ access_token, token_type, expires_in, … }` | `{ "error": "invalid_grant", "error_description": "…" }`（`error_description` 可能没有） |
| `POST /api/oauth2/introspect` | 同上 | `{ "active": true, … }` 或 `{ "active": false }` | 400 `{ "error": "invalid_request" }` 或 401 `{ "error": "invalid_client" }` |
| `POST /api/oauth2/revoke` | 同上 | 200，响应体为空 | 同上一行 |

- 这三个接口超出限流（429）或服务器内部错误（500）时，返回的不是 RFC 格式，而是前面[响应格式](#响应格式)里的统一错误信封 `{ code, msg, data: null, traceId }`，`code` 分别是 `A0429` 和 `A0500`；
- `GET /api/oauth2/userinfo` 和同意页内部调用的 `GET`、`POST /api/oauth2/authorize` 用的是普通的 `{ code, msg, data }` 格式。

字段、错误和限流的完整说明见 [OAuth2 接入指南](/reference/oauth2)。

## HTTP 状态码

使用真实的状态码，不是所有请求都返回 200：

| 状态码 | 含义 |
| --- | --- |
| 200 / 201 | 成功 |
| 400 | 参数校验失败（`errors` 中列出每个字段的错误） |
| 401 | 未登录或令牌失效 |
| 403 | 没有权限 |
| 404 | 不存在，**或者不在你的数据范围内** |
| 409 | 唯一性冲突，或者记录正在被引用 |
| 413 | 文件太大 |
| 422 | 业务规则不允许 |
| 429 | 请求太频繁，或者重复提交 |

## 业务错误码

`A0xxx` 通用 · `A1xxx` 认证 · `B1xxx` 用户权限 · `B2xxx` 设置 · `B3xxx` 消息 · `B4xxx` OAuth2 · `C1xxx` 存储 · `C2xxx` 定时任务 · `C3xxx` 代码生成 · `D1xxx` 工作流 · `E1xxx` 以后为业务。

## 时间与 ID

- 数据库存 UTC 时间，接口返回 ISO-8601 格式（带 `Z`），前端按本地时区显示；
- 服务端生成的时间（Excel、邮件、短信）按请求头 `X-Timezone` → 用户时区 → 默认 `Asia/Shanghai` 的顺序确定时区；
- 枚举值在接口里一律传字符串编码，显示文本由前端通过字典或翻译转换。

## 接口文档

`SWAGGER_ENABLED=true` 时，可以访问 `/api/docs`（Swagger UI）和 `/api/docs-json`。后台菜单 **系统工具 → 系统接口** 也能打开它。
