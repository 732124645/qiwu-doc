# 列表页

一个标准的列表页由这几部分组成：

```text
┌─ 查询卡片 ────────────────────────────────────────┐
│  编码 [    ]  名称 [    ]  状态 [ ▼ ]  [搜索] [重置]  │
└──────────────────────────────────────────────────┘
┌─ 表格卡片 ────────────────────────────────────────┐
│  [新增] [导出] [批量删除]        TableToolbar ⟳ ☰ 🔍 │
│  ┌──────────────────────────────────────────────┐ │
│  │ QwTable（列可以由用户自定义）                    │ │
│  └──────────────────────────────────────────────┘ │
│                                   Pagination     │
└──────────────────────────────────────────────────┘
```

下面是岗位管理页面（`views/platform/iam/position/index.vue`）的完整结构，分段讲解。

## 1. 数据：useCrudList

```ts
import { useCrudList } from '@/core/composables/use-crud'

const {
  query,        // 查询条件 + 分页 + 排序（响应式，直接绑定到表单）
  rows,         // 当前页数据
  total,        // 总条数
  loading,      // 是否在加载
  filtered,     // 当前是否有查询条件（没有结果时显示"清除条件"）
  selection,    // 勾选的行
  search,       // 搜索（回到第 1 页）
  reset,        // 重置查询条件（保留排序）
  refresh,      // 按当前条件重新加载
  onSelectionChange,
  onSortChange,
  remove,       // remove([id])：确认后删除，然后刷新
  batchRemove,  // 删除勾选的行
  exporting,    // 是否在导出
  exportXlsx,   // exportXlsx('文件名.xlsx')：按当前条件导出
} = useCrudList({
  api: positionApi,
  filters: { code: '', name: '', enabled: null as string | null },   // 查询条件的初始值
  sort: 'sortNo',                                                      // 默认排序；'-createdAt' 表示倒序
})
```

- 页面打开时会**自动加载**第一页；
- 值为空字符串或 `null` 的查询条件不会发送给后端；
- **日期范围**：查询条件命名为 `xxxRange`（值是 `[开始, 结束]`），会自动转换成 `xxxFrom` 和 `xxxTo` 两个参数；只选日期时，结束日期会包含当天的全部时间。

## 2. 列定义

```ts
import type { QwColumn } from '@/core/composables/use-table-prefs'

const columns: QwColumn[] = [
  { prop: 'code', label: 'field.iam.position.code', sortable: true, width: 140, showOverflowTooltip: true },
  { prop: 'name', label: 'field.iam.position.name', sortable: true, width: 160 },
  { prop: 'enabled', label: 'field.iam.position.enabled', width: 100 },
  { prop: 'createdAt', label: 'field.common.createdAt', sortable: true, width: 160 },
  { prop: 'note', label: 'field.iam.position.note', minWidth: 120, showOverflowTooltip: true },
]
```

| 字段 | 说明 |
| --- | --- |
| `prop` | 数据字段 |
| `label` | 表头，**是翻译键**。设置 `literal: true` 时原样显示，用于用户自己填写的标题（比如审批数据页里表单字段的标题） |
| `sortable` | 是否可以排序（由后端排序，字段必须在 schema 的排序白名单里） |
| `width` / `minWidth` | 宽度。短的列给固定宽度，文字最长的列用 `minWidth` 占满剩余空间 |
| `align` | `left` / `center` / `right`，数字通常右对齐 |
| `hidden` | 默认隐藏，用户可以在列设置中打开 |
| `fixed` | `'left'` 固定在左侧 |
| `showOverflowTooltip` | 文字过长时显示省略号，鼠标悬停时显示完整内容 |

**用户可以自己调整显示哪些列、列的顺序**，设置会保存在服务端，换一台电脑也能保持。

## 3. 模板

```vue
<template>
  <div class="qw-page">
    <!-- 查询卡片 -->
    <el-card v-show="showSearch" class="qw-search-panel">
      <el-form :model="query" inline @submit.prevent="search">
        <el-form-item :label="t('field.iam.position.code')">
          <el-input v-model="query.code" clearable />
        </el-form-item>
        <el-form-item :label="t('field.iam.position.enabled')">
          <DictSelect v-model="query.enabled" code="core.enabled" />
        </el-form-item>
        <el-form-item class="qw-search-actions">
          <el-button type="primary" plain native-type="submit">{{ t('crud.action.search') }}</el-button>
          <el-button @click="reset">{{ t('crud.action.reset') }}</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格卡片 -->
    <el-card class="qw-table-panel">
      <TableToolbar v-model:search="showSearch" table-id="iam.position" :columns="columns" @refresh="refresh">
        <el-button v-perm="positionPerms.create" type="primary" @click="openForm()">
          {{ t('crud.action.create') }}
        </el-button>
        <el-button v-perm="positionPerms.export" :loading="exporting"
                   @click="exportXlsx(`${t('menu.iam.position')}.xlsx`)">
          {{ t('crud.action.export') }}
        </el-button>
      </TableToolbar>

      <QwTable
        table-id="iam.position"
        :columns="columns"
        :data="rows"
        :loading="loading"
        :filtered
        selection
        @selection-change="onSelectionChange"
        @sort-change="onSortChange"
        @reset-filters="reset"
      >
        <!-- 自定义某一列的显示：#cell-<prop> -->
        <template #cell-name="{ row }">{{ tx(row.name) }}</template>
        <template #cell-createdAt="{ row }">{{ dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') }}</template>

        <!-- 操作列：#actions -->
        <template #actions="{ row }">
          <el-button v-if="canEdit" link type="primary" @click="openForm(row.id)">{{ t('crud.action.edit') }}</el-button>
          <el-button v-perm="positionPerms.remove" link type="danger" @click="remove([row.id])">
            {{ t('crud.action.delete') }}
          </el-button>
        </template>
      </QwTable>

      <Pagination v-model:page="query.page" v-model:page-size="query.pageSize" :total="total" @change="refresh" />
    </el-card>
  </div>
</template>
```

## 组件说明

### QwTable

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `table-id` | 必填 | 表格标识，格式 `<域>.<模块>`，用来保存用户的列设置 |
| `columns` | 必填 | 列定义 |
| `data` | 必填 | 数据 |
| `loading` | `false` | |
| `selection` | `false` | 是否显示勾选列 |
| `selectable` | | `(row) => boolean`，哪些行可以勾选 |
| `filtered` | `false` | 有查询条件时，空结果会显示"清除条件"按钮 |
| `actions-width` | 140 | 操作列宽度 |

插槽：`#cell-<prop>`（自定义某一列）、`#actions`（操作列，固定在右侧）、`#empty`。其他 `el-table` 的属性和事件都会透传。

### TableToolbar

左侧放操作按钮（默认插槽），右侧是刷新、列设置、显示或隐藏查询卡片三个按钮。`v-model:search` 控制查询卡片是否显示。

### Pagination

`v-model:page`、`v-model:page-size`、`total`。每页条数可选 10、20、50、100。总数为 0 时不显示。

## 时间显示

项目没有统一的时间格式化函数，直接用 dayjs：

```ts
dayjs(row.createdAt).format('YYYY-MM-DD HH:mm')
```

接口返回的是 UTC 时间，dayjs 会自动转换成浏览器的本地时区。

## 行内开关

列表里直接切换启用状态，是很常见的需求：

```vue
<template #cell-enabled="{ row }">
  <el-switch v-if="canModify" size="small" :model-value="row.enabled"
             @change="setEnabled(row, $event as boolean)" />
  <DictTag v-else code="core.enabled" :value="row.enabled" />
</template>
```

```ts
async function setEnabled(row: PositionVo, enabled: boolean) {
  // 失败时请求层会弹出提示；无论成功还是失败，重新加载后都显示数据库里的真实状态
  await positionApi.setEnabled(row.id, enabled).catch(() => undefined)
  await refresh()
}
```
