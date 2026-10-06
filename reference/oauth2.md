---
description: '第三方系统接入 OAuth2 的指南：登记客户端、授权码 + PKCE、刷新令牌、userinfo、introspect、revoke 和客户端凭证，附命令示例、错误码与限流说明。'
---

# OAuth2 接入指南

这一页写给**第三方系统的开发者**：怎样让你的系统"用栖梧账号登录"，读取用户的基本资料，或者以机器身份申请令牌。功能介绍和管理员的操作见[单点登录（OAuth2）](/features/oauth)。

## 概览

栖梧是一个 OAuth2 授权服务器，支持：

- **授权码 + PKCE**（RFC 6749 + RFC 7636）：PKCE 必须用，而且只接受 `S256`；
- **刷新令牌**：每次刷新都换一对新令牌；
- **客户端凭证**（`client_credentials`）：机器对机器，不代表任何用户；
- **令牌校验**（RFC 7662 introspection）和**令牌撤销**（RFC 7009 revocation）。

不支持：

- OIDC：没有 `id_token`，没有 discovery 和 JWKS 地址；
- `password` 和 `implicit` 授权方式；
- 公共客户端：目前只支持**机密客户端**，申请、校验、撤销令牌都必须带客户端密钥，用了 PKCE 也一样。纯前端网页和手机 App 要经过自己的后端接入。

令牌是不透明的随机字符串（43 个 base64url 字符），**不是 JWT**，第三方没法自己验签。想知道令牌是否有效，调用 [introspect](#_2-6-校验令牌-introspect) 或直接调用 [userinfo](#_2-4-读取用户信息-userinfo)。服务端只保存令牌的 SHA-256 摘要。

## 接口一览

| 方法 | 路径 | 谁调用 | 认证 | 限流（每个 IP） | 响应 |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/sso?…` | 用户的浏览器 | 本系统的登录状态 | — | 授权同意页（前端页面） |
| `GET` | `/api/oauth2/authorize` | 只由 `/sso` 页面调用 | 本系统的登录会话 | 120 次/分钟 | 统一信封 |
| `POST` | `/api/oauth2/authorize` | 只由 `/sso` 页面调用 | 本系统的登录会话 | 120 次/分钟 | 统一信封 |
| `POST` | `/api/oauth2/token` | 第三方后端 | 客户端密钥 | 600 次/分钟 | RFC 6749 原始 JSON |
| `POST` | `/api/oauth2/introspect` | 第三方后端 | 客户端密钥 | 1200 次/分钟 | RFC 7662 原始 JSON |
| `POST` | `/api/oauth2/revoke` | 第三方后端 | 客户端密钥 | 1200 次/分钟 | 空响应体 |
| `GET` | `/api/oauth2/userinfo` | 第三方后端 | `Bearer` 访问令牌，带 `user.read` | 不限 | 统一信封 |

- 第三方**不要直接调用** `/api/oauth2/authorize`。它只接受本系统自己的登录会话，第三方令牌一律 401，所以第三方没法替用户点同意。把用户的浏览器带到 `/sso` 就可以了；
- `/token`、`/introspect`、`/revoke` 的请求体是表单编码（`application/x-www-form-urlencoded`），客户端认证用 HTTP Basic，或者表单字段 `client_id` + `client_secret`，二选一；
- 统一信封就是[API 约定](/reference/api#响应格式)里的 `{ code, msg, data }`。

::: warning 演示模式下不能接入
栖梧开启演示模式（`APP_DEMO_MODE=true`，公开演示站用的只读模式）时，`POST /api/oauth2/authorize`、`/token`、`/introspect`、`/revoke` 一律返回 403（`A0431`），授权走不完。联调请用没有开启演示模式的安装。
:::

命令示例按 macOS 和 Windows PowerShell 分栏；共用项目命令（如 `pnpm dev`）不分栏。Windows 示例使用 PowerShell 自带的 HTTP 命令，避免 `curl` 别名和外部程序引号传参的差异；正常响应会显示 JSON。HTTP 出错时 PowerShell 会显示红色错误，第一行就是服务端返回的 JSON，比如 `Invoke-RestMethod : {"error":"invalid_grant","error_description":"Invalid grant: authorization code is invalid"}`，不显示状态码；需要状态码时，紧接着执行 `$Error[0].Exception.Response.StatusCode.value__`。下面的变量要在**同一个终端**里依次设置和使用，关闭终端后需要重新设置。

## 1. 登记客户端

请管理员在 **系统管理 → 客户端管理** 中新增一个客户端（字段说明见[单点登录 · 客户端管理](/features/oauth#客户端管理)），然后把这些信息交给你：

| 信息 | 说明 |
| --- | --- |
| 客户端标识（`client_id`） | 比如 `crm`，区分大小写，创建后不能改 |
| 客户端密钥（`client_secret`） | 只在创建和重置时显示一次，服务端只存摘要 |
| 回调地址（`redirect_uri`） | 必须是 `https://`，本机调试可以用 `http://localhost` 或 `http://127.0.0.1`（可以带端口）；不能有 `#`、`*`、空白、反斜杠或用户名密码。授权时**逐字比对**：大小写、末尾的 `/`、多出的查询参数都算不同 |
| 授权方式 | `authorization_code`、`refresh_token`、`client_credentials` 中的若干项 |
| 授权范围（`scope`） | 目前只有 `user.read` |
| 访问令牌有效期 | 300–86400 秒，默认 1800 |
| 刷新令牌有效期 | 3600–2592000 秒，默认 604800；也是一次授权的最长时间 |

也可以用接口登记。`BASE` 是后台地址（见下一节的变量），`ADMIN_TOKEN` 是有 `oauth.client.create` 权限的管理员调用 `POST /api/auth/login` 后返回的 `accessToken`（见[认证](/backend/auth)）。响应 201，`data.secret` 就是唯一一次显示的明文密钥：

::: code-group

```bash [macOS]
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"clientId":"crm","name":"CRM","grantTypes":["authorization_code","refresh_token","client_credentials"],
       "redirectUris":["http://localhost:8080/cb"],"scopes":["user.read"],"autoApproveScopes":[]}' \
  "$BASE/api/oauth/clients"
```

```powershell [Windows（PowerShell）]
$BASE = 'http://localhost:5173'
$ADMIN_TOKEN = '粘贴管理员的 accessToken'
$CLIENT = @{
  clientId = 'crm'
  name = 'CRM'
  grantTypes = @('authorization_code', 'refresh_token', 'client_credentials')
  redirectUris = @('http://localhost:8080/cb')
  scopes = @('user.read')
  autoApproveScopes = @()
}
Invoke-RestMethod -Method Post -Uri "$BASE/api/oauth/clients" -Headers @{ Authorization = "Bearer $ADMIN_TOKEN" } -ContentType 'application/json; charset=utf-8' -Body ($CLIENT | ConvertTo-Json -Depth 3) | ConvertTo-Json -Depth 5
```

:::

## 2. 授权码 + PKCE

下面用本机开发环境演示（`pnpm dev`，后台在 `http://localhost:5173`，`/api` 由 Vite 转发到服务端）。先登记一个客户端：标识 `crm`，三种授权方式都选，回调地址 `http://localhost:8080/cb`，授权范围 `user.read`，记下密钥。8080 端口上不需要真的有服务，浏览器回跳时显示"无法连接"，从地址栏复制 `code` 就行。

::: code-group

```bash [macOS]
BASE=http://localhost:5173                  # 生产环境换成 https://<后台域名>
CLIENT_ID=crm
CLIENT_SECRET='<创建或重置时显示的密钥>'
REDIRECT_URI=http://localhost:8080/cb        # 和登记的值一字不差
```

```powershell [Windows（PowerShell）]
$BASE = 'http://localhost:5173'              # 生产环境换成 https://<后台域名>
$CLIENT_ID = 'crm'
$CLIENT_SECRET = '粘贴创建或重置时显示的密钥'
$REDIRECT_URI = 'http://localhost:8080/cb'    # 和登记的值一字不差
$BASIC = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${CLIENT_ID}:${CLIENT_SECRET}"))
```

:::

PowerShell 的 `$BASIC` 是客户端标识和密钥的 HTTP Basic 编码，后面的令牌请求会用到；更换客户端密钥后要重新生成。

### 2.1 生成 code_verifier、code_challenge 和 state

每次授权都生成一组新的。`VERIFIER` 留在你的后端（比如放进用户的会话），不要交给浏览器：

::: code-group

```bash [macOS]
VERIFIER=$(openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n')
CHALLENGE=$(printf %s "$VERIFIER" | openssl dgst -binary -sha256 | openssl base64 | tr '+/' '-_' | tr -d '=\n')
STATE=$(openssl rand -hex 16)
```

```powershell [Windows（PowerShell）]
$VERIFIER = node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
$CHALLENGE = node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('base64url'))" -- $VERIFIER
$STATE = node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

:::

`CHALLENGE` 是 `VERIFIER` 的 SHA-256 再做 base64url 编码、去掉 `=`，正好 43 个字符。生成命令成功时没有输出；macOS 用 `printf '%s\n' "$CHALLENGE"`、PowerShell 输入 `$CHALLENGE`，应该能看到这串值。Windows 使用已安装的 Node.js，不需要额外安装 OpenSSL。

### 2.2 把用户带到同意页

::: code-group

```bash [macOS]
ENC_REDIRECT=$(node -p 'encodeURIComponent(process.argv[1])' "$REDIRECT_URI")
# macOS 用 open，Linux 用 xdg-open，也可以把链接复制到浏览器
open "$BASE/sso?response_type=code&client_id=$CLIENT_ID&redirect_uri=$ENC_REDIRECT&scope=user.read&state=$STATE&code_challenge=$CHALLENGE&code_challenge_method=S256"
```

```powershell [Windows（PowerShell）]
$ENC_REDIRECT = [Uri]::EscapeDataString($REDIRECT_URI)
Start-Process "$BASE/sso?response_type=code&client_id=$CLIENT_ID&redirect_uri=$ENC_REDIRECT&scope=user.read&state=$STATE&code_challenge=$CHALLENGE&code_challenge_method=S256"
```

:::

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `response_type` | 是 | 只能是 `code` |
| `client_id` | 是 | 客户端标识 |
| `redirect_uri` | 是 | 和登记的某一个回调地址一字不差；换令牌时还要再传一次同样的值 |
| `code_challenge` | 是 | 上一步的 `CHALLENGE`，43 个字符 |
| `code_challenge_method` | 是 | 只能是 `S256`，写 `plain` 或者不写都会被拒绝 |
| `scope` | 否 | 空格分隔；不写时取客户端登记的全部范围；超出登记范围时请求无效 |
| `state` | 否 | 原样带回。用来防 CSRF，回调时**一定要核对** |

运行打开链接的命令后，你应该看到浏览器中的登录页或同意页。

浏览器里接下来会发生：

1. 用户没登录时先到登录页，登录后回到同一个同意页；
2. 用户点"同意授权"，浏览器跳到 `http://localhost:8080/cb?code=<授权码>&state=<STATE>`；
3. 用户点"拒绝"，浏览器跳到 `http://localhost:8080/cb?error=access_denied&state=<STATE>`（请求里没有 `state` 时，回调里也没有）；
4. 申请的范围都是自动授权的，或者用户已经记住了对这个客户端的授权，同意页不再询问，直接回跳；
5. 请求本身无效时，页面停在 `/sso` 显示原因，**不会回跳**，见[同意页上的错误](#同意页上的错误)。

登记的回调地址本身带查询参数时，参数会保留在前面。比如登记的是 `https://q.example/cb?tenant=7`，回跳地址是 `https://q.example/cb?tenant=7&code=…&state=…`。

::: code-group

```bash [macOS]
CODE='<地址栏里的 code>'      # 300 秒内有效，只能兑换一次
```

```powershell [Windows（PowerShell）]
$CODE = '粘贴地址栏里的 code'      # 300 秒内有效，只能兑换一次
```

:::

### 2.3 用授权码换令牌

::: code-group

```bash [macOS]
curl -sS -u "$CLIENT_ID:$CLIENT_SECRET" \
  --data-urlencode grant_type=authorization_code \
  --data-urlencode "code=$CODE" \
  --data-urlencode "redirect_uri=$REDIRECT_URI" \
  --data-urlencode "code_verifier=$VERIFIER" \
  "$BASE/api/oauth2/token"
```

```powershell [Windows（PowerShell）]
$FORM = @{
  grant_type = 'authorization_code'
  code = $CODE
  redirect_uri = $REDIRECT_URI
  code_verifier = $VERIFIER
}
Invoke-RestMethod -Method Post -Uri "$BASE/api/oauth2/token" -Headers @{ Authorization = "Basic $BASIC" } -ContentType 'application/x-www-form-urlencoded' -Body $FORM | ConvertTo-Json
```

:::

- 请求体只能是表单编码（`curl --data-urlencode` 默认就是）。发 JSON，或者把字段写成数组（`code[]=…`），都返回 400 `invalid_request`；
- HTTP Basic 里的标识和密钥不做表单解码。服务端生成的密钥只含 URL 安全的字符，不受影响。

成功时返回 200，带 `Cache-Control: no-store` 和 `Pragma: no-cache`：

```json
{
  "access_token": "<43 个字符>",
  "token_type": "Bearer",
  "expires_in": 1800,
  "refresh_token": "<43 个字符>",
  "scope": "user.read"
}
```

- `expires_in` 是客户端的访问令牌有效期（秒）；离这次授权的最长时间不够这么久时，取剩下的时间；
- 客户端没有 `refresh_token` 授权方式时，响应里没有 `refresh_token`，访问令牌过期后这次授权就结束了；
- `scope` 用空格分隔。

::: code-group

```bash [macOS]
AT='<access_token>'
RT='<refresh_token>'
```

```powershell [Windows（PowerShell）]
$AT = '粘贴 access_token'
$RT = '粘贴 refresh_token'
```

:::

### 2.4 读取用户信息（userinfo）

::: code-group

```bash [macOS]
curl -sS -H "Authorization: Bearer $AT" "$BASE/api/oauth2/userinfo"
```

```powershell [Windows（PowerShell）]
Invoke-RestMethod -Uri "$BASE/api/oauth2/userinfo" -Headers @{ Authorization = "Bearer $AT" } | ConvertTo-Json
```

:::

返回本系统的统一信封（不是 OIDC 的 userinfo 格式）：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "sub": "1",
    "username": "admin",
    "name": "Administrator",
    "avatarUrl": null,
    "locale": null
  }
}
```

| 字段 | 说明 |
| --- | --- |
| `sub` | 用户 ID（字符串），不会变。**用它关联你系统里的账号** |
| `username` | 登录名。管理员可以修改，不要用来关联账号 |
| `name` | 姓名（显示名） |
| `avatarUrl` | 头像地址，没有时为 `null`。文件存在本地时是本站的相对路径（`/files/…`），要拼上后台的地址才能访问；存在 S3 时是完整的 `https://` 地址 |
| `locale` | 用户选择的界面语言（`zh-CN` 或 `en-US`），没选过时为 `null` |

只有这五项，没有手机号、邮箱、部门和角色。

| 情况 | 结果 |
| --- | --- |
| 令牌没有 `user.read` | 403，`A0430` |
| `client_credentials` 申请的令牌（不代表任何用户） | 403，`B4003` |
| 令牌无效、过期、被撤销；用户已改密码、被停用或被删除 | 401 |

本系统自己的后台登录会话也可以调用 userinfo，返回的是本人的资料。

### 2.5 刷新令牌

::: code-group

```bash [macOS]
curl -sS -u "$CLIENT_ID:$CLIENT_SECRET" \
  --data-urlencode grant_type=refresh_token \
  --data-urlencode "refresh_token=$RT" \
  "$BASE/api/oauth2/token"
```

```powershell [Windows（PowerShell）]
$FORM = @{ grant_type = 'refresh_token'; refresh_token = $RT }
Invoke-RestMethod -Method Post -Uri "$BASE/api/oauth2/token" -Headers @{ Authorization = "Basic $BASIC" } -ContentType 'application/x-www-form-urlencoded' -Body $FORM | ConvertTo-Json
```

:::

响应和[换令牌](#_2-3-用授权码换令牌)一样，`refresh_token` 是新的。要注意：

- **每次刷新都换一对新令牌**。旧的访问令牌立即失效；旧的刷新令牌只有 **30 秒宽限期**，请马上换用新的；
- 宽限期内用**同一个 User-Agent** 重发旧的刷新令牌，拿到的是同一对新令牌，所以网络重试是安全的。超过 30 秒，或者换了 User-Agent 再用旧刷新令牌，会被当作令牌被盗用：**整个会话被吊销**，返回 `invalid_grant`，用户要重新授权。所以你的后端发请求时要用固定的 User-Agent；
- 访问令牌有效期固定，不会因为使用而延长。整个授权的最长时间是客户端的刷新令牌有效期，从用授权码换到令牌时算起，刷新不会延长。到期后返回 `invalid_grant`，让用户重新走 `/sso`（已记住的授权会自动通过，用户只看到一次跳转）；
- 刷新时不用带 `scope`，新令牌沿用原来的范围。带了超出原范围的 `scope` 会返回 `invalid_scope`，但这时令牌已经换过了：30 秒内用原来的刷新令牌、不带 `scope` 重试仍然可以；
- 刷新令牌只能由签发它的客户端使用。别的客户端拿去刷新会返回 `invalid_grant`，原会话不受影响。

### 2.6 校验令牌（introspect）

::: code-group

```bash [macOS]
curl -sS -u "$CLIENT_ID:$CLIENT_SECRET" --data-urlencode "token=$AT" "$BASE/api/oauth2/introspect"
```

```powershell [Windows（PowerShell）]
Invoke-RestMethod -Method Post -Uri "$BASE/api/oauth2/introspect" -Headers @{ Authorization = "Basic $BASIC" } -ContentType 'application/x-www-form-urlencoded' -Body @{ token = $AT } | ConvertTo-Json
```

:::

```json
{
  "active": true,
  "client_id": "crm",
  "scope": "user.read",
  "token_type": "Bearer",
  "exp": 1790000000,
  "sub": "1",
  "username": "admin"
}
```

- `exp` 是过期时间（Unix 秒）。访问令牌和刷新令牌都可以查；查刷新令牌时没有 `token_type`；`client_credentials` 的令牌没有 `sub` 和 `username`；
- 只有**本客户端**签发、并且仍然有效的令牌才返回 `active: true`。别的客户端的令牌、后台登录会话的令牌、不存在、过期或已撤销的令牌，都只返回 `{"active": false}`；
- `token_type_hint` 可以带，但会被忽略。缺少 `token` 返回 400 `invalid_request`；客户端认证失败返回 401 `invalid_client`。

### 2.7 撤销令牌（revoke）

::: code-group

```bash [macOS]
curl -sS -i -u "$CLIENT_ID:$CLIENT_SECRET" --data-urlencode "token=$RT" "$BASE/api/oauth2/revoke"
```

```powershell [Windows（PowerShell）]
Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$BASE/api/oauth2/revoke" -Headers @{ Authorization = "Basic $BASIC" } -ContentType 'application/x-www-form-urlencoded' -Body @{ token = $RT }
```

:::

- 成功返回 200，响应体为空；PowerShell 示例的输出中应看到 `StatusCode : 200`。传访问令牌或刷新令牌都可以，都会结束**整个会话**，两个令牌一起失效；
- 不存在的令牌、别的客户端的令牌也返回 200，但什么都不会改变。客户端认证失败返回 401 `invalid_client`；
- 用户在你的系统里退出登录或解除绑定时，调用它。

## 3. 客户端凭证（client_credentials）

::: code-group

```bash [macOS]
curl -sS -u "$CLIENT_ID:$CLIENT_SECRET" --data-urlencode grant_type=client_credentials "$BASE/api/oauth2/token"
```

```powershell [Windows（PowerShell）]
Invoke-RestMethod -Method Post -Uri "$BASE/api/oauth2/token" -Headers @{ Authorization = "Basic $BASIC" } -ContentType 'application/x-www-form-urlencoded' -Body @{ grant_type = 'client_credentials' } | ConvertTo-Json
```

:::

```json
{
  "access_token": "<43 个字符>",
  "token_type": "Bearer",
  "expires_in": 1800,
  "scope": "user.read"
}
```

- 没有 `refresh_token`，过期后重新申请；
- `scope` 可以不写，默认取客户端登记的全部范围；超出登记范围返回 `invalid_scope`。客户端没有登记 `client_credentials` 方式时返回 `unauthorized_client`。客户端没有登记任何授权范围时，申请会返回 `invalid_scope`；
- 这种令牌不代表任何用户：调用 userinfo 返回 403 `B4003`，调用其他需要登录的接口返回 401。目前还没有接受机器令牌的业务接口，可以对它做 introspect（结果里没有 `sub`）和 revoke；
- 它的会话也出现在 **系统监控 → 在线用户** 里，但只有超级管理员能看到和强退。

## 4. 错误

### 令牌接口的错误

`/token`、`/introspect`、`/revoke` 出错时返回 RFC 6749 §5.2 格式的原始 JSON：

```json
{ "error": "invalid_grant", "error_description": "Invalid grant: authorization code is invalid" }
```

请按 `error` 判断。`error_description` 是英文的诊断信息，有时没有，不要解析它。

| `error` | HTTP 状态码 | 什么时候出现 |
| --- | --- | --- |
| `invalid_request` | 400 | 请求体不是表单（比如 JSON），或者字段是数组、对象；缺少必填参数；换令牌时没带 `redirect_uri`，或者和授权请求里的不一样；introspect、revoke 没带 `token` |
| `invalid_client` | `/token` 用表单字段认证时 400；用 HTTP Basic 认证时，以及 introspect、revoke，都是 401，并带 `WWW-Authenticate: Basic` | 没带密钥（用了 PKCE 也一样）、密钥错误、客户端不存在、已停用或已删除、标识是 `console` 或 `mobile` |
| `invalid_grant` | 400 | 授权码错误、过期（300 秒）、已经用过、属于别的客户端，`code_verifier` 错误或缺失；授权后用户改了密码、换了手机号、被重置密码、被停用、被删除或被"强退该用户"；客户端已经不再登记这个回调地址；刷新令牌无效、过期、宽限期外被重放、属于别的客户端，或者授权已到最长时间 |
| `unauthorized_client` | 400 | 客户端没有登记这种授权方式 |
| `unsupported_grant_type` | 400 | `password`、`implicit` 或不认识的 `grant_type` |
| `invalid_scope` | 400 | `client_credentials` 申请的范围超出登记范围，或者客户端没有登记任何授权范围；换授权码时，授权码里的范围已经不在客户端当前登记的范围内（比如授权后管理员删掉了某个范围）；刷新时的范围超出原来的授权 |

- 换令牌失败（授权码错误、`code_verifier` 错误、`redirect_uri` 不一致）时，**这个授权码也作废了**，只能让用户重新走一遍 `/sso`；
- 有三种情况返回的不是 RFC 格式，而是本系统的错误信封 `{ code, msg, data: null, traceId }`：超出限流返回 429，`code` 是 `A0429`；栖梧开启了演示模式时返回 403，`code` 是 `A0431`；服务端内部错误（包括 Redis 暂时连不上）返回 500，`msg` 里没有内部细节，可以凭 `traceId` 请管理员查日志。

### 回调地址收到的结果

你的回调地址只会收到两种结果：`?code=…&state=…`（用户同意），或者 `?error=access_denied&state=…`（用户拒绝）。其他错误都不会回跳。

### 同意页上的错误

`/sso` 把地址里的参数原样交给 `GET /api/oauth2/authorize` 检查。请求无效时页面停在 `/sso`，显示服务端返回的原因。排查接入问题时，可以对照这些错误码：

| 错误码 | 状态码 | 原因 |
| --- | --- | --- |
| `B4001` | 400 | 客户端不存在、已停用、是本系统自己的客户端（`console`、`mobile`），或者没有登记授权码方式；`redirect_uri` 不是登记的回调地址之一（逐字比对） |
| `B4002` | 400 | `response_type` 不是 `code`；`scope` 为空，或者超出客户端登记的范围 |
| `A0401` | 400 | 参数格式不对：缺少 `redirect_uri`；缺少 `code_challenge` 或者长度不是 43；`code_challenge_method` 缺失或不是 `S256` |
| `A1004` | 403 | 当前登录的账号必须先修改密码 |
| `A0429` | 429 | 同一个 IP 每分钟超过 120 次 |

### OAuth2 相关的错误码

| 错误码 | 状态码 | 含义 |
| --- | --- | --- |
| `B4001` | 400 | 授权请求里的客户端或回调地址无效 |
| `B4002` | 400 | 授权请求无效（`response_type` 或 `scope`） |
| `B4003` | 403 | 令牌不代表任何用户，不能读取用户信息（`client_credentials` 令牌调用 userinfo） |
| `B4010` | 422 | 内置客户端受保护：在客户端管理里修改、启用停用、重置密钥或删除 `console` 时返回 |

`B4xxx` 段留给 OAuth2，错误码的分段见[API 约定 · 业务错误码](/reference/api#业务错误码)。

## 5. 限流

| 接口 | 上限（每个来源 IP） |
| --- | --- |
| `GET /api/oauth2/authorize` | 120 次/分钟 |
| `POST /api/oauth2/authorize` | 120 次/分钟 |
| `POST /api/oauth2/token` | 600 次/分钟 |
| `POST /api/oauth2/introspect` | 1200 次/分钟 |
| `POST /api/oauth2/revoke` | 1200 次/分钟 |

- 超出后返回 429 错误信封（`code` 是 `A0429`），不是 RFC 格式；
- 按来源 IP 计数。栖梧部署在反向代理后面时，`TRUST_PROXY` 要设成代理的地址，否则所有请求都算在代理一个 IP 上，见[部署 · OAuth2 与单点登录](/guide/deploy#oauth2-与单点登录)；
- 计数存在 Redis 里，栖梧部署了多个服务实例时，所有实例共用同一份额度；
- 你的后端一般只有一个出口 IP，上限是按"一个后端的正常流量"定的。如果你的资源服务器每个请求都要 introspect，可以按令牌把结果缓存几秒，代价是令牌被撤销后，最多还会被接受这么久。

## 6. 令牌什么时候失效

| 情况 | 结果 |
| --- | --- |
| 访问令牌过期 | 用刷新令牌换一对新的 |
| 授权到了最长时间（客户端的刷新令牌有效期） | `invalid_grant`，让用户重新走 `/sso` |
| 你调用了 revoke | 整个会话结束 |
| 旧刷新令牌在宽限期外被重放 | 整个会话结束 |
| 用户改密码、换手机号、被重置密码（管理员重置或短信找回）、被停用、被删除、连续输错当前密码，或者被管理员"强退该用户" | 这个用户的所有 OAuth 会话和还没兑换的授权码一起失效 |
| 管理员在在线用户里强退某一个会话 | 这个会话结束 |
| 客户端被停用或删除 | 它的所有会话立即结束，之后刷新、introspect、revoke 都返回 `invalid_client` |
| 客户端密钥被重置 | 已签发的令牌**不受影响**，只是旧密钥不能再用来认证 |

第三方令牌只能调用 userinfo。调用后台的其他接口（比如 `/api/iam/users`、`/api/auth/me`）都返回 401；后台的 `/api/auth/refresh` 也不接受 OAuth 的刷新令牌。

## 7. 接入清单

1. 客户端密钥只放在你的服务端，不进浏览器、App 或代码仓库。泄露了就请管理员重置；
2. 每次授权都生成新的 `code_verifier` 和 `state`；回调时先核对 `state`，再用同一个 `code_verifier` 换令牌；
3. 授权请求和换令牌时传的 `redirect_uri` 必须和登记的值完全一样；
4. 拿到授权码马上换令牌：300 秒内有效，只能用一次，换失败的码也会作废；
5. 刷新令牌加密存在服务端；刷新后马上换用新的一对；后端发请求时用固定的 User-Agent；
6. 刷新返回 `invalid_grant` 时，让用户重新走 `/sso`；
7. 用 `sub` 关联账号，不要用 `username`；`avatarUrl` 是相对路径时拼上后台的地址；
8. 用户在你的系统里退出登录或解除绑定时，调用 revoke；
9. 按 `error` 字段处理错误，不要解析 `error_description`；遇到 429 稍后重试；
10. 生产环境的回调地址用 `https://`。`/token`、`/introspect`、`/revoke`、`/userinfo` 都是服务器对服务器调用，不需要跨域（CORS），也不要在浏览器里调用 `/token`。
