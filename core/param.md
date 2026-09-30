# 参数设置

**什么时候用参数？** 一个配置值需要让管理员在后台修改，并且改完立即生效，不需要改代码或重新部署。比如登录失败几次后锁定、上传文件大小上限、日志保留天数。

::: tip 参数和环境变量的区别
- **环境变量**：部署时决定的、和运行环境有关的配置（数据库地址、密钥），改了需要重启；
- **参数**：业务规则方面的配置，管理员在 **系统管理 → 参数设置** 中修改，立即生效。
:::

## 读取参数

注入 `ParamService`（全局提供）：

```ts
import { ParamService } from '../../../../core/settings/param.service.js'

constructor(private readonly params: ParamService) {}
```

| 方法 | 说明 |
| --- | --- |
| `get(key)` | 返回字符串，参数不存在时返回 `null` |
| `int(key, 最小值, 最大值, 默认值)` | 读取整数。参数不存在、为空或者超出范围时，返回默认值 |
| `getPublic(key)` | 读取"公开"的参数（未登录时也能读取的，比如是否开放注册） |

项目里清理日志的定时任务是这样读取保留天数的：

```ts
@JobHandler('audit.purge')
async purge(_params: object, { signal, log }: JobContext) {
  const days = await this.params.int(
    AUDIT_RETENTION_PARAM,           // 'audit.retention_days'
    1,
    36_500,
    DEFAULT_AUDIT_RETENTION_DAYS,    // 180
  )
  // …
}
```

**参数值都是管理员填写的字符串，一定要做好兜底**：数字用 `int()` 限定范围；布尔值和 JSON 需要自己解析，解析失败时使用默认值。

### 键名和默认值放在共享包里

```ts
// packages/shared/src/common/params.ts（示例）
export const AUDIT_RETENTION_PARAM = 'audit.retention_days'
export const DEFAULT_AUDIT_RETENTION_DAYS = 180
```

这样前端需要显示默认值时，也能引用同一个常量。

## 新增参数：写种子

```ts
import { upsert } from '../../../../db/seeds/upsert.js'

await upsert(
  q,
  'cfg_param',
  { param_key: 'crm.customer.vip_threshold' },            // 按键名查找
  {
    name: 'VIP 消费门槛（元）',
    name_i18n: { 'zh-CN': 'VIP 消费门槛（元）', 'en-US': 'VIP spending threshold' },
    group_code: 'crm',
    is_builtin: 1,                                        // 内置参数不能被删除
    is_public: 0,
  },
  { param_value: '10000' },                               // 只在第一次插入时写入
)
```

`upsert` 的第 4 个参数每次执行种子都会更新，第 5 个参数**只在第一次插入时写入**。参数值放在第 5 个参数里，这样管理员修改过的值不会被重新执行种子覆盖。

### 敏感参数

设置 `is_secret: 1` 的参数，在页面上会显示为掩码，不能同时设置为公开，并且在操作日志中会被隐藏。

## 缓存

参数读取会经过 Redis 缓存，管理员修改后缓存立即失效。直接修改数据库或者重新执行种子时，缓存最多 1 小时后失效；也可以在参数设置页面点击"刷新缓存"。
