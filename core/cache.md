# 缓存

先读一下 [Redis 是做什么的](/backend/redis)。这一页讲具体怎么写。

::: tip 先想想是不是真的需要缓存
有索引的 MySQL 查询通常只需要几毫秒。缓存会带来"数据不一致"的问题，所以确认存在性能瓶颈之后再加。
:::

## 第一步：登记命名空间

所有 Redis 键都必须先在 `apps/server/src/core/redis/cache-namespaces.ts` 里登记：

```ts
export const CACHE_NAMESPACES = {
  // …
  /** `entries:{code}` → a dict's payload (DictService) */
  dict: ns('dict:', true, false),
  /** @Idempotent */
  idem: ns('idem:', true, false),
  // 新增你的命名空间：
  /** `{customerId}` → 客户统计数据 */
  customerStats: ns('biz:customer-stats:', true, false),
} as const satisfies Record<string, CacheNamespace>
```

`ns(前缀, 能否清理, 是否隐藏值)` 的三个参数：

| 参数 | 说明 |
| --- | --- |
| 前缀 | 会拼在全局前缀 `qw:` 后面 |
| 能否清理 `clearable` | "缓存列表"页面上能不能删除这类键 |
| 是否隐藏值 `masked` | "缓存列表"页面上显不显示值。密钥或者其他用户的隐私数据要设为 `true` |

## 第二步：生成键，读写数据

```ts
import { Inject, Injectable } from '@nestjs/common'
import { redisKey } from '../../../../core/redis/cache-namespaces.js'
import { REDIS, type Redis } from '../../../../core/redis/redis.module.js'

@Injectable()
export class CustomerStatsService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async stats(customerId: number): Promise<CustomerStats> {
    const key = redisKey('customerStats', customerId)      // → qw:biz:customer-stats:42
    const cached = await this.redis.get(key)
    if (cached) return JSON.parse(cached) as CustomerStats

    const stats = await this.loadFromDb(customerId)
    await this.redis.set(key, JSON.stringify(stats), {
      expiration: { type: 'EX', value: 600 },              // 10 分钟后过期
    })
    return stats
  }

  /** 数据变化后调用：删除缓存，下次读取时重新加载 */
  async invalidate(customerId: number): Promise<void> {
    await this.redis.del(redisKey('customerStats', customerId))
  }
}
```

- `REDIS` 是全局模块提供的，直接注入，不需要导入模块；
- 客户端是 **node-redis**（不是 ioredis），所以设置过期时间的写法是 `{ expiration: { type: 'EX', value: 秒数 } }`；
- `redisKey()` 会对每一段做 URI 编码，所以即使某一段来自用户输入（比如包含 `:` 的用户名），也拼不出其他格式的键。

::: danger 不要直接写字符串键
`this.redis.get('biz:customer-stats:42')` 这种写法会被 `pnpm verify` 的检查脚本拦下来。所有键都要通过 `redisKey()` 生成。
:::

## 让缓存失效

**原则：先提交数据库事务，再删除缓存。** 如果先删缓存、后提交事务，在这两步之间另一个请求可能又把旧数据读进了缓存。

```ts
async update(id: number, dto: CustomerUpdate) {
  await super.update(id, dto)           // 事务在这里提交
  await this.stats.invalidate(id)       // 然后再删除缓存
}
```

## 进阶：带版本号的缓存

项目的字典和参数使用了更严谨的写法 `readThrough`（在 `core/settings/dict.service.ts` 中）：每个缓存还有一个版本号，修改数据时让版本号加一，读取时发现版本号变了就不写入旧数据。这样可以避免"删除缓存"和"写入旧数据"同时发生导致的不一致。

一般的业务缓存用上面的简单写法就够了。确实需要强一致时，可以参考这个实现。
