---
title: 给模块加 MCP 工具
description: '用 @McpTool 把模块的服务方法开放给智能体：工具名、权限点、zod 参数规则、写入类工具的声明与注册方式，MCP 客户端的配置示例，以及怎样用 curl 和 e2e 测试检查工具。'
---

# 给模块加 MCP 工具

::: tip 后台怎么用
这一页讲写代码。MCP 是什么、开关、两种令牌和护栏，见[MCP 智能体接入](/features/mcp)。
:::

智能体能调用的每个**工具**，就是一个服务类的方法加上 `@McpTool` 装饰器。方法像控制器一样，在调用者的租户、权限和数据范围下运行，所以直接调用模块已有的服务就行。权限点检查、限流、超时、输出遮蔽和操作日志都由底座统一处理，工具里不用自己写。

完整规则见仓库的[给自己的模块加工具](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/mcp.md#给自己的模块加工具)。

## 写一个工具

下面以项目模块 `crm/customer` 为例（`customerPerms` 在共享包里，`CustomerService` 是[代码生成器](/features/codegen)生成的服务），开放一个“按名称查客户”的只读工具：

```ts
// apps/server/src/modules/crm/customer/customer.mcp-tools.ts
import { Injectable } from '@nestjs/common'
import { customerPerms } from '@qiwu/shared'
import { z } from 'zod'
import { McpTool } from '../../../core/mcp/mcp-tool.js'
import { CustomerService } from './customer.service.js'

const findInput = z.object({
  name: z.string().trim().max(64).optional().describe('part of the customer name'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
})

const findOutput = z.object({
  total: z.number().int(),
  items: z.array(z.object({ id: z.number().int(), name: z.string(), level: z.string() })),
})

@Injectable()
export class CustomerMcpTools {
  constructor(private readonly customers: CustomerService) {}

  /** 按名称查客户：与客户列表同一查询，数据权限一致。 */
  @McpTool({
    name: 'crm.customer.search',
    title: 'Search customers',
    description:
      'Finds customers the caller may see by part of their name; one page with the total.',
    perm: customerPerms.browse,
    kind: 'read',
    input: findInput,
    output: findOutput,
  })
  async search(input: z.output<typeof findInput>) {
    const { items, total } = await this.customers.page({ ...input })
    return { total, items }
  }
}
```

然后把 `CustomerMcpTools` 加进这个模块的 `providers`。启动时自动注册，不需要迁移，也不需要菜单。

::: tip 模块文件会被生成器覆盖时
生成器重新生成时会覆盖模块文件。这时可以像示例图书的 `apps/server/src/modules/demo/book/book.mcp-tools.ts` 那样，把工具单独放进一个小模块，再在 `modules/project.module.ts` 里注册。
:::

## 声明的规则

启动时会检查每个工具的声明，任何一条不满足，服务都拒绝启动：

| 字段 | 规则 |
| --- | --- |
| `name` | 全局唯一，写成 `<域>.<资源>.<动作>`，只用小写字母、数字和连字符，最长 96 个字符 |
| `title`、`description` | 给智能体看的标题和说明，写清楚工具做什么、返回什么 |
| `perm` | **权限点**：必须是共享包里某个 `*Perms` 常量中的权限点，和控制器用的是同一个。只有任何登录用户都能看的数据（本人资料、字典标签）才写 `null` |
| `kind` | `'read'` 或 `'write'`。会改数据的工具一律声明为 `'write'`，它只对明确允许写入的令牌开放 |
| `input` | **参数规则**：zod 的对象规则。调用前先校验，同时转成给智能体看的参数说明，所以请给字段写 `.describe()` |
| `output` | 可选，也是 zod 对象规则。结果按它解析，多余的字段被丢掉，免得把内部字段交给智能体 |
| `timeoutMs` | 可选，默认 30 秒，最长 120 秒 |
| `sensitive` | 可选：名称普通、值却可能是秘密的参数名（比如 `note`），在操作日志里遮成 `***`。名称像密钥的参数本来就会遮蔽 |
| `feature` | 可选：工具所属的顶层菜单组（路由名）。租户套餐不含这个组时，这个租户的用户用不了它 |

几点补充：

- **租户套餐**：带 `perm` 的工具随租户套餐收窄；`perm: null` 的工具**不受套餐限制**，只想给某些套餐用时声明 `feature`。挂在平台专属页面权限点上的工具，只给默认租户（平台）的用户用。见[编写租户感知的代码](/core/tenancy)；
- **错误**：工具里抛出的业务错误（`BizError`、404、409 等）会按请求语言翻译后返回给智能体，其他异常只返回通用错误，详情只写进服务端日志。见[异常处理](/core/errors)；
- **写入类工具保持短小**：超时只结束等待，已经开始的数据库操作无法中断，所以写入类工具最好是一次短事务。

## 配置客户端

任何支持 Streamable HTTP 传输、能设置自定义请求头的 MCP 客户端都可以连接。很多客户端用下面这种 JSON 配置格式（以个人访问令牌为例，令牌在个人中心的 **访问令牌** 页签里创建）：

```json
{
  "mcpServers": {
    "qiwu": {
      "type": "http",
      "url": "https://qiwu.example.com/api/mcp",
      "headers": { "Authorization": "Bearer qwmcp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
    }
  }
}
```

把 `url` 换成你的地址，把令牌换成自己创建的那个。不同客户端的配置文件位置和字段名略有不同，以客户端自己的文档为准。用 SDK 在自己的程序里连接的写法见仓库的[客户端配置示例](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/mcp.md#客户端配置示例)。

## 测试工具

### 手动调用

先在服务端的 `.env` 里设 `APP_MCP=true` 并重启，在个人中心建一个令牌，再用 curl 直接调用工具。下面调用本机服务端（默认端口 3000）的 `iam.me.get`：

::: code-group

```bash [macOS]
export QW_TOKEN='qwmcp_...'   # 换成你的令牌
curl -sS http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $QW_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"iam.me.get","arguments":{}}}'
```

```powershell [Windows（PowerShell）]
$env:QW_TOKEN = 'qwmcp_...'   # 换成你的令牌
Set-Content -Path mcp-body.json -Encoding Ascii -Value '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"iam.me.get","arguments":{}}}'
curl.exe -sS http://localhost:3000/api/mcp -H "Authorization: Bearer $env:QW_TOKEN" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" --data-binary "@mcp-body.json"
```

:::

Windows 上要写 `curl.exe`（在 PowerShell 5.1 里单写 `curl` 是另一个命令的别名），请求体先写进文件，避免 PowerShell 改掉 JSON 里的引号。把 `tools/call` 换成 `tools/list`（`params` 写 `{}`）可以看到这个令牌能用的全部工具。

请求头 `Accept` 必须同时包含 `application/json` 和 `text/event-stream`，SDK 客户端会自动带上。

### 自动测试

服务端测试的配置 `apps/server/.env.test` 已经打开了 `APP_MCP`。仓库的 `apps/server/test/e2e/mcp-kit.ts` 提供了几个辅助函数：

- `patFor(app, userId, { allowWrite, tools })`：直接给某个用户建一个个人访问令牌；
- `callTool(app, token, name, args)`：调用工具，返回结果数据或错误码；
- `toolNames(app, token)`：这个令牌在工具列表里能看到哪些工具。

照着示例工具的测试 `mcp-tools.e2e-spec.ts` 写，至少覆盖：有权限的用户调用成功；没有权限点的用户被拒绝（错误码 `A0430`）；参数不合法被拒绝（`A0401`）；数据范围外的数据查不到或写不进去；写入类工具在不允许写入的令牌上被拒绝（`B7003`）。运行方式和其他服务端测试一样：

```bash
pnpm --filter @qiwu/server test crm-customer-mcp.e2e
```

测试文件名要全局唯一，见[后端测试](/backend/testing#运行测试)。仓库里其他 MCP 测试（协议、认证、护栏、开关）的位置见[智能体接入文档](https://github.com/732124645/qiwu-vue-admin/blob/main/docs/mcp.md)开头。

## 相关链接

- [MCP 智能体接入](/features/mcp)：开关、令牌、护栏和管理页面
- [权限与数据范围](/core/permission)：权限点和 `*Perms` 常量
- [参数校验](/core/validation)：zod 规则的写法
- [操作日志](/core/action-log)：智能体调用记在哪里
