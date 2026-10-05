# 接口请求

前端调用后端接口，统一通过 `apps/web/src/core/request/http.ts`。它已经处理好了：带上登录令牌、令牌过期时自动刷新并重发、解开统一的返回格式、出错时自动提示。

## 每个模块一个接口文件

```ts
// src/api/platform/iam/position.ts
import type { PositionCreate, PositionOption, PositionVo } from '@qiwu/shared'
import { api, crudApi } from '@/core/request/http'

const BASE = '/iam/positions'

export const positionApi = {
  ...crudApi<PositionVo, PositionCreate>(BASE),        // 标准的增删改查
  setEnabled: (id: number, enabled: boolean) => api.put(`${BASE}/${id}/enabled`, { enabled }),
  options: () => api.get<PositionOption[]>(`${BASE}/options`),
}
```

地址不用写 `/api` 前缀，请求层会自动加上。类型来自共享包，和后端是同一份定义。

### crudApi 提供的方法

| 方法 | 对应的接口 |
| --- | --- |
| `page(params)` | `GET /` → `{ items, total }` |
| `get(id)` | `GET /:id` |
| `create(dto)` | `POST /` |
| `update(id, dto)` | `PUT /:id` |
| `remove(ids)` | 一个 id：`DELETE /:id`；多个：`POST /batch-delete` |
| `exportFile(params, filename)` | 下载 `GET /export` |

树形数据用 `treeApi`：`list(params)` 返回整棵树，`remove(id)` 一次只删除一个节点。

## api：发送请求

```ts
import { api } from '@/core/request/http'

const row = await api.get<CustomerVo>(`/crm/customers/${id}`)
const created = await api.post<CustomerVo>('/crm/customers', dto)
await api.put(`/crm/customers/${id}/upgrade`)
await api.delete(`/crm/customers/${id}`)

// 查询参数
const page = await api.get<Page<CustomerVo>>('/crm/customers', { params: { page: 1, name: '张' } })
```

**返回的就是 `data` 部分**，不是整个 `{ code, msg, data }`。第二个（`post`/`put` 是第三个）参数是 axios 的配置。

## 自动处理了什么

### 请求头

| 请求头 | 内容 |
| --- | --- |
| `Authorization` | `Bearer <访问令牌>` |
| `Accept-Language` | 当前界面语言，后端据此翻译错误信息 |
| `X-Request-Id` | 随机的请求编号，就是错误信息中的 `traceId` |
| `X-Timezone` | 浏览器时区。后端据此格式化 Excel 中的时间；登录时还会记到用户资料里，之后发给这个用户的消息按它显示时间 |

### 登录过期

收到 401 时，请求层会用刷新令牌换一个新的访问令牌，然后**自动重发**刚才的请求，用户察觉不到。同一个标签页里多个请求同时过期，只会刷新一次；多个标签页的刷新会排队，一个接一个进行。

刷新的结果分两种：

| 刷新的结果 | 怎么处理 |
| --- | --- |
| 被服务端拒绝（401，比如在别处退出了登录、会话到了上限） | 弹出"会话已过期"对话框，让用户选择"重新登录"或者"留在本页"（保留没有保存的内容） |
| 没有得到回答（网络错误、429、5xx，比如服务端正在重启） | **不弹**对话框，会话还在；只提示"网络异常，请稍后重试"，这次请求失败 |

**只有刷新返回 401，才说明会话结束了。** 这段逻辑在 `apps/web/src/core/request/http.ts` 的响应拦截器里，"暂时失败"由同一个文件导出的 `isTransient(e)` 判断。

### 服务端暂时连不上

打开或刷新页面时，路由守卫要先换访问令牌、读取当前用户和菜单（见[路由与菜单 · 路由守卫的流程](/core/web-router#路由守卫的流程)）。服务端重启、滚动发布时，这几步可能失败，守卫会这样处理（`apps/web/src/core/router/index.ts` 的 `patiently`）：

1. 网络错误、429、5xx：等待后重试，间隔依次是 1、1、2、2、3、3、4、4 秒，总共约 20 秒（请求本身的时间也算在内，所以一直卡住、30 秒才超时的请求不会再重试）；
2. 仍然失败：跳到 `/503`，页面上有"重试"和"登录"两个按钮。"重试"回到原来要打开的页面，守卫再试一轮；
3. 只有刷新被拒绝（401，或者这个浏览器上没有登录记录）才跳到登录页。

这样，开发时先重启了服务端、或者生产环境发布新版本，用户不需要重新登录。

::: warning 页面里的请求不会自动重试
重试只发生在守卫的这几步。页面里调用接口失败（包括 502、503 和网络错误），请求层只弹一次提示，然后把错误抛给调用方；需要重试的，自己处理。
:::

### 错误提示

| 状态码 | 自动弹出提示吗 |
| --- | --- |
| 400 | 否（表单会显示具体字段的错误） |
| 401 | 否（按上面的规则处理） |
| 403、409、422、429 | **是**，显示后端返回的信息 |
| 404 | 否 |
| 500 及以上 | **是** |
| 网络错误 | **是** |

还有两点：

- **相同的提示会合并**：文字完全一样的错误提示只显示一条，旁边显示重复的次数。服务端重启时一批请求同时失败，用户只会看到一条"网络异常，请稍后重试"；
- **不是后端返回的错误**：响应里没有统一的返回格式时（比如服务端重启期间，nginx 或开发代理返回的 502），提示"网络异常，请稍后重试"，`ApiError` 的 `code` 是 HTTP 状态码。

所以大部分情况下，**调用接口时不需要写 try/catch**，失败时提示已经弹出来了：

```ts
async function setEnabled(row: PositionVo, enabled: boolean) {
  await positionApi.setEnabled(row.id, enabled).catch(() => undefined)   // 失败时已经提示过了
  await refresh()
}
```

## 错误处理

需要针对某种错误做特殊处理时，捕获 `ApiError`：

```ts
import { Err } from '@qiwu/shared'
import { ApiError } from '@/core/request/http'

try {
  await customerApi.upgrade(id)
} catch (e) {
  if (e instanceof ApiError && e.code === Err.CRM_CUSTOMER_DISABLED.code) {
    // 特殊处理
  }
}
```

`ApiError` 的字段：

| 字段 | 说明 |
| --- | --- |
| `status` | HTTP 状态码 |
| `code` | 业务错误码。**判断错误类型用它，不要用 `message`** |
| `message` | 后端已经翻译好的错误信息 |
| `errors` | 参数校验失败时，每个字段的错误 `[{ path, msg }]` |
| `traceId` | 请求编号 |

### 不要自动提示：silent

想自己决定怎么提示时，加上 `silent: true`：

```ts
try {
  await api.post('/crm/customers/check', dto, { silent: true })
} catch (e) {
  error.value = e instanceof ApiError ? e.message : t('common.error.network')
}
```

`silent` 会关闭错误提示和"会话已过期"对话框，其他行为不变：

- 401 仍然会刷新令牌并重发请求；
- 账号必须修改密码时，仍然会跳到修改密码页面；
- 请求失败时，捕获到的不一定是 `ApiError`：网络错误（包括 401 后刷新令牌时遇到的网络错误）是 axios 的错误。所以上面的例子用 `e instanceof ApiError` 判断，其他情况显示通用的网络错误。

需要区分"暂时失败"和其他错误时（比如给用户一个"重试"按钮），用 `isTransient`：

```ts
import { isTransient } from '@/core/request/http'

try {
  await api.get('/crm/customers/stats', { silent: true })
} catch (e) {
  canRetry.value = isTransient(e)   // 网络错误、429、5xx
}
```

## 下载文件

```ts
import { download, fetchBlob } from '@/core/request/http'

// 下载并保存为文件
await download('/crm/customers/export', { name: '张' }, '客户.xlsx')

// 只取得文件内容（比如预览私有图片）
const blob = await fetchBlob(`/storage/objects/${id}/download`)
const url = URL.createObjectURL(blob)
```

`<img src>` 和 `<a href>` 无法带上登录令牌，所以需要登录才能访问的文件，都要用这两个函数。

## 上传文件

一般直接使用上传组件，见[文件上传](/core/upload)。需要自己上传时：

```ts
import { storageApi } from '@/api/platform/storage/object'

const obj = await storageApi.upload(file, 'attachment', (percent) => {
  progress.value = percent
})
// obj.id、obj.url（公开文件才有）、obj.originalName …
```

自己写的上传接口，用 `FormData`：

```ts
const form = new FormData()
form.append('mode', 'insert')           // 文本字段放在文件前面
form.append('file', file)
await api.post('/crm/customers/import', form)
```

## 开发时的代理

开发时，Vite 会把这些路径转发到后端（`http://127.0.0.1:3000`）：

| 路径 | 用途 |
| --- | --- |
| `/api` | 接口 |
| `/files` | 公开文件 |
| `/socket.io` | 实时推送 |

后端不在本机时，用环境变量 `API_PROXY_TARGET` 指定地址：

::: code-group

```bash [macOS]
API_PROXY_TARGET=http://192.168.1.10:3000 pnpm --filter @qiwu/web dev
```

```powershell [Windows（PowerShell）]
$env:API_PROXY_TARGET = "http://192.168.1.10:3000"
pnpm --filter @qiwu/web dev
```

:::

PowerShell 的设置会保留在当前终端里；停止开发服务器后，用 `Remove-Item Env:API_PROXY_TARGET` 清除，或关闭这个终端。启动后，前端的 `/api` 请求应该转发到这个地址。

生产环境由 nginx 做同样的转发，见[部署](/guide/deploy)。
