# 字典

**什么时候用字典？** 一个字段只能取几个固定的值，并且这些值的显示文字需要多语言、需要管理员能够调整时。比如性别、客户等级、请假类型。

数据库里只保存**编码**（比如 `vip`），显示的文字（"VIP 客户" / "VIP"）由字典提供。

## 定义字典：写种子

```ts
// db/seeds/demo/demo.seed.ts
import { type DictSeed, upsertDicts } from '../settings/settings.seed.js'

const DICTS: DictSeed[] = [
  {
    code: 'demo.genre',                                      // 字典编码：<域>.<名称>
    nameI18n: { 'zh-CN': '图书分类', 'en-US': 'Book genre' },
    entries: [
      { value: 'fiction', labelI18n: { 'zh-CN': '小说', 'en-US': 'Fiction' } },
      { value: 'science', labelI18n: { 'zh-CN': '科普', 'en-US': 'Popular science' } },
      // …
    ],
  },
]

export async function seedDemo(q: EntityManager): Promise<string[]> {
  await upsertDicts(q, DICTS)
  // …
  return []
}
```

每个字典项还可以设置：

| 字段 | 说明 |
| --- | --- |
| `tagType` | 在 `<DictTag>` 中显示为什么颜色的标签：`primary`、`success`、`info`、`warning`、`danger` |
| `isDefault` | 是否为默认项 |

规则：

- 字典编码用点分隔：`biz.customer_level`，不要用 `a:b:c` 这种写法；
- 值是字符串编码，布尔值存为 `'true'` / `'false'`；
- 每种语言都要填写；
- 字典项按数组的顺序排序。

执行 `pnpm db:seed` 之后，这个字典就会出现在 **系统管理 → 字典管理** 中，管理员可以修改文字、调整顺序、停用某一项。

::: tip 种子不会覆盖已删除的数据
管理员删除了某个字典项之后，重新执行种子也不会把它恢复回来。
:::

## 前端使用

### 下拉框：DictSelect

```vue
<script setup lang="ts">
import DictSelect from '@/core/components/DictSelect.vue'
</script>

<template>
  <!-- 查询条件 -->
  <DictSelect v-model="query.genre" code="demo.genre" />
  <!-- 表单 -->
  <DictSelect v-model="model.genre" code="demo.genre" />
  <!-- 多选：其他属性会透传给 el-select -->
  <DictSelect v-model="query.genres" code="demo.genre" multiple />
</template>
```

### 显示标签：DictTag

```vue
<template #cell-genre="{ row }">
  <DictTag code="demo.genre" :value="row.genre" />
</template>
```

字典项设置了 `tagType` 时显示为彩色标签，否则显示为普通文字。

### 在代码里使用：useDict

```ts
import { useDict } from '@/core/composables/use-dict'

const { options, label } = useDict('iam.gender')
// options：[{ value, label }]，label 已经是当前语言的文字，可以直接用于 el-radio 等组件
// label(value)：把一个值转换成当前语言的文字
```

::: warning 组件需要手动导入
`DictSelect` 和 `DictTag` 没有全局注册，每个页面都要自己 `import`。
:::

字典在第一次使用时加载，之后会缓存起来。管理员修改字典后，前端会自动更新。

## 后端使用

后端主要用字典做两件事：**校验**和**显示文字**。

- **校验**：在 zod 规则中限制取值范围。如果取值在代码里是固定的，用 `z.enum([...])`；生成的代码只检查长度；
- **显示文字**：Excel 导出、消息通知里需要文字时，已经自动处理了：Excel 列上写 `dict: 'demo.genre'`，通知参数写 `{ dict: 'demo.genre', value }`。

确实需要自己读取字典时，注入 `DictService`：

```ts
import { DictService } from '../../../../core/settings/dict.service.js'
import { currentLocale } from '../../../../core/i18n/locale.js'

const lang = currentLocale()                               // 当前请求的语言
const payload = await this.dicts.entries('demo.genre')    // 只包含启用的项，按顺序排列；字典不存在时为 null
const labels = (payload?.entries ?? []).map((e) => [e.value, e.labelI18n?.[lang] ?? e.label])
```

`DictService` 是全局提供的，结果缓存在 Redis 中，管理员修改后会自动失效。
