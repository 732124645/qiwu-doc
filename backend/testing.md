# 写测试

前端项目很多时候可以不写测试，但**后端一定要写**。原因很简单：后端的错误往往看不见，比如权限没有生效、数据范围漏了一个条件，页面上一切正常，数据却已经泄露了。只有测试能证明"没有权限的人真的访问不到"。

## 两种测试

| | 单元测试 | e2e 测试 |
| --- | --- | --- |
| 测什么 | 一个纯函数（比如流程引擎、金额计算） | 一个完整的接口：从 HTTP 请求到数据库 |
| 需要数据库吗 | 不需要 | 需要（使用独立的测试库 `qiwu_test`） |
| 文件名 | `xxx.spec.ts` | `xxx.e2e-spec.ts` |
| 位置 | 源码旁边或 `test/` 下 | `apps/server/test/e2e/` |

业务模块主要写 **e2e 测试**。测试框架是 Vitest，写法和前端的 Vitest 完全一样。

## e2e 测试的结构

下面是项目里一个真实的测试文件（`iam-position-extra.e2e-spec.ts`），删减了一部分：

```ts
import type { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import { getDataSourceToken } from '@nestjs/typeorm'
import request from 'supertest'
import type { DataSource } from 'typeorm'
import { AppModule } from '../../src/app.module.js'
import { setupApp } from '../../src/app.setup.js'
import { REDIS, type Redis } from '../../src/core/redis/redis.module.js'
import { bearer, signIn } from '../setup/auth.js'
import { cleanRedis } from '../setup/redis.js'

const PREFIX = 'pos-extra-'          // 本测试创建的数据都带这个前缀，方便清理
const URL = '/api/iam/positions'

let app: NestExpressApplication
let ds: DataSource
let redis: Redis
let token: string

// 发请求的小工具：自动带上登录令牌
const call = (method: 'get' | 'post' | 'delete', path = '', body?: object) => {
  const req = request(app.getHttpServer())[method](`${URL}${path}`).set(bearer(token))
  return body ? req.send(body) : req
}

// 所有测试开始前：启动一个完整的应用，并用 admin 登录
beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  app = setupApp(moduleRef.createNestApplication<NestExpressApplication>({ logger: false }))
  await app.listen(0, '127.0.0.1')        // 端口 0 = 随机空闲端口
  ds = app.get<DataSource>(getDataSourceToken())
  redis = app.get(REDIS)
  await cleanRedis(redis)
  token = (await signIn(app)).accessToken
})

// 所有测试结束后：删除本测试创建的数据，关闭应用
afterAll(async () => {
  if (ds) await ds.query('DELETE FROM iam_position WHERE code LIKE ?', [`${PREFIX}%`])
  if (redis) await cleanRedis(redis)
  await app?.close()
})

it('name filter: seeded rows are found by their text in any language', async () => {
  const names = async (name: string) =>
    (await call('get').query({ name }).expect(200)).body.data.items.map((r: { name: string }) => r.name)

  expect(await names('技术负责')).toEqual(['seed.position.engLead'])
  expect(await names('engineering LEAD')).toEqual(['seed.position.engLead'])
})
```

可以看到，e2e 测试就是：**启动整个应用 → 用 `supertest` 发真实的 HTTP 请求 → 检查状态码和返回内容**。

## 一个接口至少测什么

| 情况 | 期望 | 为什么要测 |
| --- | --- | --- |
| 正常操作 | 200 / 201，数据正确 | 功能本身 |
| 没有权限 | 403 | 证明 `@RequirePerm` 真的生效了 |
| 参数不合法 | 400 | 证明校验生效了 |
| 不存在，或超出数据范围 | 404 | 证明别人的数据访问不到 |
| 违反业务规则 | 409 / 422 | 证明业务规则生效了 |

代码生成器生成的测试已经覆盖了标准的增删改查。你只需要为**自己加的功能**补充测试，写在 `<模块>-extra.e2e-spec.ts` 里。

## 测试没有权限的用户

生成的测试文件里有准备"只读用户"的完整写法：新建一个角色，只给它 `browse` 权限，再新建一个属于这个角色的用户并登录。自己写测试时照着复制就行。

## 运行测试

```bash
# 运行一个测试文件（用文件名，不带 .ts；不要加 --）
pnpm --filter @qiwu/server test crm-customer-extra.e2e

# 只运行名称里包含 upgrade 的用例
pnpm --filter @qiwu/server test crm-customer-extra.e2e -t upgrade
```

::: warning 测试文件名要全局唯一
Vitest 按文件路径的**子串**过滤。如果你有 `customer.e2e-spec.ts` 和 `crm-customer.e2e-spec.ts`，运行 `test customer.e2e` 会把两个都跑一遍。所以项目要求测试文件名在整个仓库里唯一，并且不能是别的文件名的一部分。
:::

## 测试用的数据库

测试使用独立的配置 `apps/server/.env.test`：数据库 `qiwu_test`、Redis 15 号库，**和开发环境的数据完全隔离**。第一次运行前，需要先建库并授权：

```sql
CREATE DATABASE qiwu_test CHARACTER SET utf8mb4;
GRANT ALL ON qiwu_test.* TO 'qiwu'@'localhost';
```

测试启动时会自动执行迁移。

## 写测试的几个习惯

- **测试数据要带前缀**，结束时按前缀删除，不要影响其他测试；
- **每个测试自己准备数据**，不要依赖另一个测试先运行；
- **要测"不能做"的事**：没有权限、超出范围、违反规则。这些才是最容易出问题的地方；
- 断言要具体：不要只检查 `status === 200`，也要检查数据确实改对了。
