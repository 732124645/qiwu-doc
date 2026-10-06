---
description: '字典的开发写法：用种子预置字典、重新执行种子时哪些不覆盖、用数据迁移改已有文字，以及 DictSelect、DictTag、useDict 和 DictService 的用法。'
---

# 字典

::: tip 后台怎么用
这一页讲写代码。后台页面能做什么、各项设置的含义，见[系统管理 · 字典管理](/features/system#字典管理)。
:::

这里说的字典，就是后台 **系统管理 → 字典管理** 页面里管理的数据。

## 字典是什么

字典就是**下拉框的选项表**。有些字段只能从几个固定的值里选一个，比如：

| 字典编码 | 字典名称 | 选项（值 → 显示文字） |
| --- | --- | --- |
| `iam.gender` | 性别 | `male` → 男，`female` → 女 |
| `demo.genre` | 图书分类 | `fiction` → 小说，`science` → 科普…… |
| `core.enabled` | 启用状态 | `true` → 启用，`false` → 停用 |

数据库里只保存**值**（比如 `male`），页面上显示的是**文字**（"男"，切换成英文界面时显示 "Male"）。

**什么时候用字典？** 一个字段只能取几个固定的值，并且这些值的显示文字需要多语言、需要管理员能够调整时。比如性别、客户等级、请假类型。

## 三个角色

```text
开发者：用种子"预置"字典  →  管理员：在字典管理页面"维护"字典  →  页面：下拉框和标签"使用"字典
```

| 谁 | 在哪里 | 做什么 |
| --- | --- | --- |
| 开发者 | 种子代码（下面的 `upsertDicts`） | 写新功能时**预先把字典建好**。项目初始化时，这些字典就会自动出现在字典管理页面里，管理员不用手动去建 |
| 管理员 | 系统管理 → 字典管理 | 修改显示文字、调整顺序、停用或新增选项。重新执行种子**不会覆盖**这些修改，见下面的[重新执行种子](#重新执行种子) |
| 页面 | `DictSelect`、`DictTag` 组件 | 给它一个字典编码，它就显示成下拉框或彩色标签。管理员改了文字，这里跟着变 |

::: tip 不写代码也能建字典
管理员可以直接在字典管理页面里新建字典。但如果你的代码要用到这个字典（比如下拉框写了 `code="crm.customer_level"`），最好用种子预置它，否则换一个新环境部署时，这个字典就不存在了。
:::

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
| `isDefault` | 是否为默认项。每个字典最多一个默认项（停用的项也算），由数据库唯一索引保证；在字典管理里再设一个默认项会返回 409，要先取消原来的 |

规则：

- 字典编码用点分隔：`crm.customer_level`，不要用 `a:b:c` 这种写法；
- 值是字符串编码，布尔值存为 `'true'` / `'false'`；
- 每种语言都要填写；
- 字典项按数组的顺序排序。

执行 `pnpm db:seed` 之后，这个字典就会出现在 **系统管理 → 字典管理** 中，管理员可以修改文字、调整顺序、停用某一项。

### 重新执行种子

字典种子**只插入、不覆盖**：字典交给管理员之后，以数据库里的为准。

| 情况 | 重新执行种子的结果 |
| --- | --- |
| 种子里有、数据库里没有的字典或字典项 | 插入 |
| 已有的字典和字典项 | 名称、文字、顺序、标签样式、默认值、启用状态都**不变**；只补上缺少的语言，已有的语言以数据库为准 |
| 管理员删除的字典或字典项 | 不恢复，也不重新插入 |

"只补缺少的语言"是为了加语言：给已经部署的系统加一种新语言，重新执行种子就会给内置字典补上这种语言的文字（见[增加一种语言](/core/i18n#增加一种语言)）。

所以，**改种子里已有项的文字、顺序、标签样式或默认值，重新执行种子不会生效**：

- **开发时**：改了自己项目的字典种子，执行 `pnpm db:reset`（清空开发数据库，再执行迁移和种子），或者直接在字典管理页面里改；
- **已经部署的环境**：除了改种子（新环境按新值插入），还要写一个数据迁移，修改已有的行。

比如把 `demo.genre` 里 `science` 的英文从 "Popular science" 改成 "Science"：

```ts
// apps/server/src/db/migrations/20261010100000-demo-genre-label.ts
import type { MigrationInterface, QueryRunner } from 'typeorm'

export class DemoGenreLabel20261010100000 implements MigrationInterface {
  name = 'DemoGenreLabel20261010100000'

  async up(q: QueryRunner): Promise<void> {
    // 只改还是旧文字的行，管理员改过的不动
    await q.query(
      `UPDATE cfg_dict_entry SET label_i18n = JSON_SET(label_i18n, '$."en-US"', ?)
        WHERE dict_code = ? AND value = ? AND label_i18n->>'$."en-US"' = ?`,
      ['Science', 'demo.genre', 'science', 'Popular science'],
    )
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE cfg_dict_entry SET label_i18n = JSON_SET(label_i18n, '$."en-US"', ?)
        WHERE dict_code = ? AND value = ? AND label_i18n->>'$."en-US"' = ?`,
      ['Popular science', 'demo.genre', 'science', 'Science'],
    )
  }
}
```

迁移的写法和执行见[实体与数据库 · 迁移](/core/entity#迁移)。种子、`db:reset` 和迁移都不经过字典管理页面，服务端的字典缓存不会自动失效，执行完要在字典管理里点"刷新缓存"。

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

字典在第一次使用时加载，之后缓存在浏览器里，直到刷新页面。管理员在 **系统管理 → 字典管理** 中修改后，自己的浏览器马上用新数据；其他已经打开后台的人，刷新页面后才看到。重新执行种子、`pnpm db:reset`，或者执行了修改字典的数据迁移之后，要点"刷新缓存"（否则服务端缓存最多 1 小时后才失效）。

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
