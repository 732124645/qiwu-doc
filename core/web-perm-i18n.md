# 权限与翻译

## 按权限显示

### v-perm 指令

```vue
<el-button v-perm="positionPerms.create">新增</el-button>

<!-- 数组：拥有其中任意一个权限就显示 -->
<el-button v-perm="[userPerms.modify, userPerms.remove]">…</el-button>
```

- 没有权限时，元素会被隐藏（`display: none`）；
- 管理员修改了你的权限后，按钮会**自动出现或消失**，不需要刷新页面；
- `v-perm` 是全局注册的，不需要导入。

### usePerm

需要在代码里判断，或者需要同时满足多个权限时：

```ts
import { usePerm } from '@/core/permission'

const perm = usePerm()

// 用 computed：权限变化时自动更新
const canModify = computed(() => perm.has(positionPerms.modify))
// 编辑表单要先调用 GET /:id 加载数据，所以还需要 view 权限
const canEdit = computed(() => perm.all([positionPerms.modify, positionPerms.view]))
```

| 方法 | 说明 |
| --- | --- |
| `has(perm)` | 传入字符串或数组，拥有其中任意一个即为 `true` |
| `all(perms)` | 必须全部拥有 |

::: warning 前端权限只是界面上的
`v-perm` 和 `usePerm` 只是让用户看不到没有权限的按钮。**真正的检查在后端**，参见[权限与数据范围](/features/permission)。
:::

项目里没有 `v-role` 这样按角色判断的指令。请按权限点判断，不要按角色判断：角色是管理员随时可以调整的，权限点才是代码里固定的。

## 翻译

### 在组件里

```ts
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
```

```vue
<el-button>{{ t('crud.action.save') }}</el-button>
<el-form-item :label="t('field.iam.position.code')">
```

带参数：

```ts
t('biz.customer.upgradeConfirm', { name: row.name })
// 翻译文件："确定把客户「{name}」升级为 VIP 吗？"
```

### 在组件外面

在 `.ts` 文件里（比如组合式函数、工具函数），没办法调用 `useI18n()`，要使用全局实例：

```ts
import { i18n } from '@/core/i18n'

i18n.global.t('crud.confirm.delete')
```

### tx()：可能是翻译键，也可能是普通文字

种子数据的名称（角色、部门、岗位……）保存的是翻译键，比如 `seed.position.developer`；管理员自己新建的数据保存的是普通文字，比如"运维工程师"。`tx()` 能同时处理这两种情况：

```ts
import { tx } from '@/core/i18n'

tx('seed.position.developer')   // → "开发工程师"（这个键存在，就翻译）
tx('运维工程师')                 // → "运维工程师"（这个键不存在，就原样返回）
```

显示这类名称时，一律用 `tx()`：

```vue
<template #cell-name="{ row }">{{ tx(row.name) }}</template>
```

### 翻译文件放在哪里

`apps/web/src/locales/zh-CN/` 和 `apps/web/src/locales/en-US/` 下，**两边的文件和键必须完全一致**。

文件名决定了它的内容怎么合并：

| 文件名 | 规则 | 例子 |
| --- | --- | --- |
| 不带点，比如 `crud.json` | 文件名就是命名空间，文件内容直接写键 | `{ "action": { "save": "保存" } }` → `crud.action.save` |
| 带点，比如 `biz.customer.json` | 文件内容要写完整的顶层结构 | 见下面的例子 |

生成的模块使用第二种方式，一个文件里可以同时包含模块自己的文字和菜单名称：

```json
{
  "biz": {
    "customer": {
      "entity": "客户",
      "upgrade": "升级为 VIP"
    }
  },
  "menu": {
    "biz": {
      "customer": "客户管理"
    }
  }
}
```

同一个键不能在两个文件中重复定义，`pnpm i18n:check` 会检查这一点。

### 字段名和校验提示

表单的字段名使用 `field.<域>.<字段>`（比如 `field.iam.position.code`），校验错误提示使用 `validation.*`。这两类翻译放在**共享包**里（`packages/shared/src/i18n/`），因为后端返回的校验错误也要用到它们。

### 切换语言

```ts
import { useLocaleStore } from '@/core/stores/locale'

useLocaleStore().set('en-US')
```

它会切换界面、Element Plus、dayjs 和图表的语言，并且在登录状态下把用户的语言偏好保存到服务端。之后服务端发给这个用户的消息通知，也会使用这种语言。
