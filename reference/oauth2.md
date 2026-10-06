---
description: '第三方系统接入栖梧 OAuth2 的概览：授权方式、登记客户端、授权码 + PKCE 流程、错误、限流和令牌失效；完整请求示例见仓库。'
---

# OAuth2 接入指南

这一页写给**第三方系统的开发者**：怎样让你的系统"用栖梧账号登录"，读取用户的基本资料，或者以机器身份申请令牌。功能介绍和管理员的操作见[单点登录（OAuth2）](/features/oauth)。

完整的请求和响应示例（curl + openssl，只适用于 macOS / Linux 终端）见仓库的 [OAuth2 文档](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oauth2.md)。Windows 上在界面里登记客户端，由第三方后端生成授权链接，在浏览器打开，见[仓库说明](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oauth2.md#windows-入口与-posix-教程范围)。

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

令牌是不透明的随机字符串（43 个 base64url 字符），**不是 JWT**，第三方没法自己验签。想知道令牌是否有效，调用 [introspect](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oauth2.md#26-校验令牌introspectrfc-7662) 或直接调用 [userinfo](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oauth2.md#24-用户信息userinfo)。服务端只保存令牌的 SHA-256 摘要。

## 接口一览

第三方后端调用 `/api/oauth2/token`、`/introspect`、`/revoke`（表单编码，客户端认证用 HTTP Basic 或表单里的 `client_id` + `client_secret`）和 `/api/oauth2/userinfo`（返回[统一信封](/reference/api#响应格式)）；用户的浏览器只去 `/sso`。不要直接调用 `/api/oauth2/authorize`，它只接受本系统自己的登录会话。开了演示模式的安装走不完授权，联调请用非演示安装。接口和限流一览见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oauth2.md#概览)。

## 1. 登记客户端

管理员在 **系统管理 → 客户端管理** 新增客户端（字段见[单点登录 · 客户端管理](/features/oauth#客户端管理)），把 `client_id`、只显示一次的密钥和登记的回调地址交给你；授权时回调地址逐字比对。见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oauth2.md#1-注册客户端)。

## 2. 授权码 + PKCE

① 每次授权生成随机的 `code_verifier`（用 S256 算出 `code_challenge`）和 `state`；② 把浏览器带到 `https://<后台域名>/sso?…`，用户同意后回调地址收到 `code` 和 `state`；③ 核对 `state`，用 `code` 和 `code_verifier` 调 `/api/oauth2/token` 换取访问令牌和刷新令牌；④ 之后可以刷新、读 userinfo、introspect 校验、revoke 撤销。每一步的请求见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oauth2.md#2-授权码--pkce-全流程curl--openssl仅-posix)。

## 3. 客户端凭证（client_credentials）

机器对机器的令牌没有刷新令牌，不代表任何用户，调 userinfo 返回 403。见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oauth2.md#3-client_credentials机器令牌)。

## 4. 错误

令牌接口出错时返回 RFC 格式的 JSON，按 `error` 字段处理，不要解析 `error_description`；兑换失败的授权码会作废，要让用户重新授权。回调地址只会收到 `code`，或用户拒绝时的 `error=access_denied`；其他错误停在同意页显示原因，不跳转。限流、演示模式和服务器错误返回[统一错误信封](/reference/api#响应格式)。错误码见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oauth2.md#4-错误)。

## 5. 限流

按来源 IP 限流，超出返回 429 统一信封（`A0429`）；在反向代理后面要设好 `TRUST_PROXY`，见[部署 · OAuth2 与单点登录](/guide/deploy#oauth2-与单点登录)；上限见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oauth2.md#5-限流)。

## 6. 令牌什么时候失效

用户改密、被重置、被停用、被删除或被强退，以及客户端被停用或删除时，相关会话和令牌一起失效；规则见[仓库](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oauth2.md#7-令牌隔离与会话)。

## 7. 接入清单

上线前按[仓库的第三方接入清单](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/oauth2.md#9-第三方接入清单)逐项核对。
