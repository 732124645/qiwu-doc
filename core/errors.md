# 异常处理

**在服务或控制器里直接抛出异常**，全局的异常过滤器会把它转换成统一格式的错误响应：正确的 HTTP 状态码、业务错误码、按请求语言翻译好的错误信息、请求编号。

## 抛出错误

### 业务错误：BizError

```ts
import { Err } from '@qiwu/shared'
import { BizError } from '../../../../core/http/biz-error.js'

throw new BizError(Err.DUPLICATE, { code: 'CS101' })     // 409
throw new BizError(Err.IAM_USER_SELF)                    // 不能操作自己
throw new BizError(Err.CRM_CUSTOMER_DISABLED)            // 自定义的错误码
```

`new BizError(错误定义, 参数?)`：

- 第一个参数来自共享包的 `Err`，里面包含错误码、HTTP 状态码和翻译键；
- 第二个参数是翻译文字中的占位符，比如翻译是"编码 {code} 已存在"，就传 `{ code }`。

### 通用错误：NestJS 自带的异常

```ts
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'

throw new NotFoundException()       // 404
throw new ForbiddenException()      // 403
```

**不需要写错误信息。** 过滤器会按状态码找到对应的通用错误码，并且只返回翻译好的通用信息，异常自带的文字**不会**发给客户端，防止泄露内部信息。

### 什么时候用哪个

| 情况 | 写法 | 状态码 |
| --- | --- | --- |
| 数据不存在，或不在数据范围内 | `throw new NotFoundException()` | 404 |
| 违反业务规则（比如"已停用的客户不能升级"） | `throw new BizError(Err.XXX)`，状态码定义为 422 | 422 |
| 重复（唯一性冲突） | `throw new BizError(Err.DUPLICATE, { … })` | 409 |
| 仍在被使用，不能删除 | 由 `referencedBy` 自动处理 | 409 |
| 参数格式不对 | 由 zod 规则自动处理 | 400 |
| 没有权限 | 由 `@RequirePerm` 自动处理 | 403 |

## 错误码

所有错误码定义在 `packages/shared/src/common/error-codes.ts`：

```ts
export const Err = {
  BAD_REQUEST: def('A0400', 400, 'error.common.bad_request'),
  VALIDATION_FAILED: def('A0401', 400, 'error.common.validation_failed'),
  UNAUTHENTICATED: def('A0410', 401, 'error.common.unauthenticated'),
  FORBIDDEN: def('A0430', 403, 'error.common.forbidden'),
  NOT_FOUND: def('A0440', 404, 'error.common.not_found'),
  CONFLICT: def('A0490', 409, 'error.common.conflict'),
  DUPLICATE: def('A0491', 409, 'error.common.duplicate'),
  IN_USE: def('A0492', 409, 'error.common.in_use'),
  PAYLOAD_TOO_LARGE: def('A0413', 413, 'error.common.payload_too_large'),
  UNPROCESSABLE: def('A0422', 422, 'error.common.unprocessable'),
  TOO_MANY_REQUESTS: def('A0429', 429, 'error.common.too_many_requests'),
  INTERNAL: def('A0500', 500, 'error.common.internal'),
  // … 各模块的错误码
} as const
```

`def(错误码, HTTP 状态码, 翻译键)`。

### 号段

| 号段 | 模块 |
| --- | --- |
| `A0xxx` | 通用 |
| `A1xxx` | 认证 |
| `B1xxx` | 用户、角色、菜单、部门 |
| `B2xxx` | 字典、参数 |
| `B3xxx` | 消息 |
| `C1xxx` | 文件 |
| `C2xxx` | 定时任务 |
| `C3xxx` | 代码生成 |
| `D1xxx` | 工作流 |
| `E1xxx` 起 | **你的业务** |

### 新增一个错误码

**第 1 步**：在 `Err` 中加一行（选一个没用过的编号，编号一旦发布就不要再改）：

```ts
/** params `{ max }` */
BIZ_COURSE_CREDIT_TOO_HIGH: def('E1001', 422, 'error.biz.course_credit_too_high'),
```

**第 2 步**：在 `apps/server/src/i18n/zh-CN/error.json` 和 `en-US/error.json` 中加上翻译：

```json
{
  "biz": {
    "course_credit_too_high": "学分不能超过 {max}"
  }
}
```

```json
{
  "biz": {
    "course_credit_too_high": "Credits cannot exceed {max}"
  }
}
```

**第 3 步**：使用：

```ts
throw new BizError(Err.BIZ_COURSE_CREDIT_TOO_HIGH, { max: 10 })
```

::: tip 有测试帮你检查
有一个测试会检查：`Err` 中的每一个错误码，在中文和英文里都有翻译。漏写了翻译，测试会失败。
:::

## 错误响应的格式

```http
HTTP/1.1 409 Conflict
X-Request-Id: 6f1c2a…
```

```json
{
  "code": "A0491",
  "msg": "数据已存在，不能重复",
  "data": null,
  "traceId": "6f1c2a…"
}
```

| 字段 | 说明 |
| --- | --- |
| `code` | 业务错误码。**前端判断错误类型时用它，不要用 `msg`** |
| `msg` | 按请求语言翻译好的信息，可以直接显示给用户 |
| `errors` | 只有参数校验失败时才有：`[{ path, msg }]`，每个字段的错误 |
| `traceId` | 请求编号，和响应头 `X-Request-Id`、服务端日志中的 `reqId` 相同 |

## 过滤器如何转换各种异常

| 抛出的异常 | 状态码 | 错误码 |
| --- | --- | --- |
| `BizError` | 错误定义中的状态码 | 错误定义中的错误码 |
| zod 校验失败 | 400 | `A0401`，并带上 `errors` |
| `NotFoundException` 等 NestJS 异常 | 异常的状态码 | 按状态码对应的通用错误码 |
| 数据库唯一索引冲突（MySQL 1062） | 409 | `A0491` 重复 |
| 其他任何异常 | 500 | `A0500` |

**500 错误**会被记录下来：写入服务端日志和 **日志管理 → API 错误日志**（包括异常信息和调用栈，敏感字段会被脱敏）。客户端只会收到通用的"服务器内部错误"，看不到任何内部细节。

## 前端如何处理错误

请求层会自动弹出 403、409、422、429 和 5xx 错误的提示，**一般不需要自己处理**。需要针对某种错误做特殊处理时：

```ts
import { Err } from '@qiwu/shared'
import { ApiError } from '@/core/request/http'

try {
  await customerApi.upgrade(id)
} catch (e) {
  if (e instanceof ApiError && e.code === Err.CRM_CUSTOMER_DISABLED.code) {
    // 特殊处理，比如提示用户先启用客户
  }
}
```

详见[接口请求](/core/web-request#错误处理)。

## 排查错误

1. 从浏览器开发者工具的 Network 面板，或者错误提示中，找到 `traceId`；
2. 在服务端日志中搜索这个编号；
3. 500 错误还可以在 **日志管理 → API 错误日志** 中查看完整的调用栈。

详见[排查问题](/backend/debugging)。
