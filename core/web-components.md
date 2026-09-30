# 常用组件

项目自带的组件都在 `src/core/components/` 下。

::: warning 组件需要手动导入
只有 Element Plus 的 `el-*` 组件是自动导入的，项目自己的组件**都要在页面中 import**：

```ts
import DictSelect from '@/core/components/DictSelect.vue'
```
:::

## 表格和列表

| 组件 | 说明 | 详见 |
| --- | --- | --- |
| `QwTable` | 按列数组渲染的表格，支持用户自定义列 | [列表页](/core/crud-list) |
| `TableToolbar` | 表格上方的工具栏：操作按钮、刷新、列设置、显示/隐藏查询条件 | [列表页](/core/crud-list) |
| `Pagination` | 分页。`v-model:page`、`v-model:page-size`、`total`，事件 `change` | [列表页](/core/crud-list) |
| `TreePanel` | 列表左侧的树（比如部门树），可以拖动宽度、折叠 | 见下文 |
| `QwEditTable` | 可编辑的表格，用于主子表的明细行 | 见下文 |
| `EmptyState` | 空状态提示 | |

### TreePanel：左侧的树

用户管理页面左侧的部门树就是它：

```vue
<TreePanel
  :model-value="query.deptId"
  :data="depts"
  :label="(d) => tx(d.name)"
  :title="t('picker.dept.title')"
  storage-key="iam.user"
  :loading="deptsLoading"
  @update:model-value="pickDept"
>
  <!-- 右侧的内容：查询卡片和表格卡片 -->
</TreePanel>
```

| 属性 | 说明 |
| --- | --- |
| `v-model` | 选中的节点 id |
| `data` | 树形数据 |
| `label` | 取节点显示文字的函数 |
| `title` | 标题 |
| `storage-key` | 保存宽度和折叠状态用的键 |

### QwEditTable：可编辑的明细表

```vue
<QwEditTable
  v-model="model.lines"
  label="field.demo.invoice.lines"
  :columns="invoiceLineColumns"
  :create="newInvoiceLine"
>
  <template #cell-item="{ row, index }">
    <el-form-item :prop="`lines.${index}.item`" :rules="invoiceLineRules.item">
      <el-input v-model="row.item" maxlength="128" />
    </el-form-item>
  </template>
  <template #cell-qty="{ row, index }">
    <el-form-item :prop="`lines.${index}.qty`" :rules="invoiceLineRules.qty">
      <el-input-number v-model="row.qty" :min="0" controls-position="right" />
    </el-form-item>
  </template>
</QwEditTable>
```

`create` 是一个函数，返回"添加一行"时新行的初始值；`label` 是翻译键。每个单元格用 `el-form-item` 包起来，并通过 `prop` 指定行号，这样每一行都能单独显示校验错误。

## 表单输入

| 组件 | `v-model` 的值 | 说明 |
| --- | --- | --- |
| `DictSelect` | 字符串（多选时是数组） | 字典下拉框，`code` 指定字典。详见[字典](/core/dict) |
| `DeptTreeSelect` | 部门 id（多选时是数组） | 部门树选择。`exclude` 排除某个部门及其下级（比如选择上级部门时排除自己） |
| `TreeParentSelect` | 上级节点 id（0 表示顶级） | 树表的"上级"选择，`load` 提供数据 |
| `UserSelect` | 用户 id | 选择用户（输入框 + 选择弹框） |
| `AreaCascader` | 地区编码数组 | 省市区选择 |
| `IconPicker` | 图标名，比如 `lucide:user` | 图标选择 |
| `I18nInput` | `{ 'zh-CN': '…', 'en-US': '…' }` | 同时输入中英文，比如字典标签 |
| `CronEditor` | Cron 表达式 | 可视化的 Cron 编辑器，并显示接下来的执行时间 |
| `RichEditor` | HTML 字符串 | 富文本编辑器。详见[富文本](/core/richtext) |
| `ImageUpload` | 文件对象数组 | 图片上传。详见[文件上传](/core/upload) |
| `FileUpload` | 文件对象数组 | 文件上传 |

例子：

```vue
<el-form-item :label="t('field.crm.customer.deptId')" prop="deptId">
  <DeptTreeSelect v-model="model.deptId" />
</el-form-item>

<el-form-item :label="t('field.crm.customer.ownerId')" prop="ownerId">
  <UserSelect v-model="model.ownerId" :label="row?.ownerName" />
</el-form-item>

<el-form-item :label="t('field.crm.customer.level')" prop="level">
  <DictSelect v-model="model.level" code="crm.customer_level" />
</el-form-item>
```

## 显示

| 组件 | 说明 |
| --- | --- |
| `DictTag` | 按字典显示值：`<DictTag code="core.enabled" :value="row.enabled" />` |
| `CodeViewer` | 带语法高亮的代码查看器，支持多个文件（代码生成的预览就是它） |
| `HtmlFrame` | 在沙箱 iframe 中安全地显示 HTML（邮件预览） |
| `QwChart` | ECharts 图表，切换语言时自动更新 |
| `IconButton` | 只有图标的按钮，`label` 是无障碍名称（翻译键） |

### 图标

图标使用 Lucide 图标集，已经打包在项目中，不需要联网：

```vue
<script setup lang="ts">
import { Icon } from '@/core/icons'
</script>

<template>
  <el-icon><Icon icon="lucide:plus" /></el-icon>
</template>
```

图标名的格式是 `lucide:<名字>`，可以在 lucide.dev 上查找。菜单的图标也是这个格式。

## 弹框

### openDialog

用函数的方式打开一个弹框，等待它的结果：

```ts
import { openDialog } from '@/core/dialog'

const saved = await openDialog(CustomerForm, { id }, { title: t('crud.title.edit', { name }), width: 600 })
if (saved) await refresh()
```

弹框的内容组件要声明 `done` 和 `cancel` 两个事件。详见[表单弹框](/core/crud-form#打开弹框)。

项目自带的几个弹框内容组件：

| 组件 | 作用 | `done` 的结果 |
| --- | --- | --- |
| `UserPicker` | 选择用户，`multiple` 支持多选 | 选中的用户数组 |
| `ImportDialog` | Excel 导入：下载模板、上传、选择导入模式 | 导入结果 |
| `AvatarCropper` | 裁剪头像 | 上传结果 |
| `CaptchaDialog` | 验证码 | 验证码票据 |

## 组合式函数

在 `src/core/composables/` 下：

| 函数 | 说明 |
| --- | --- |
| `useCrudList` | 列表页：查询、分页、排序、删除、导出。见[列表页](/core/crud-list) |
| `useTreeList` | 树表页：查询、展开、删除 |
| `useCrudForm` | 表单：加载、校验、提交。见[表单弹框](/core/crud-form) |
| `useDict(code)` | 字典选项和标签。见[字典](/core/dict) |
| `uploadField(model, field, kind)` | 把上传组件绑定到一个字符串字段。见[文件上传](/core/upload) |
| `useTablePrefs` | 用户的列设置（`QwTable` 内部使用） |
| `useNextFireTimes(cron)` | 计算 Cron 接下来的执行时间 |
| `useSmsCode(scene)` | 发送短信验证码，带倒计时 |
| `usePerm()` | 权限判断。见[权限与翻译](/core/web-perm-i18n) |

## 状态（Pinia）

在 `src/core/stores/` 下：

| Store | 主要内容 |
| --- | --- |
| `useAuthStore` | 当前用户 `me`、权限 `perms`、角色、`hasPerm()`、登录、退出、锁屏 |
| `useMenuStore` | 菜单树、路由、缓存的页面名称 |
| `useAppStore` | 布局设置（侧边栏/顶部/混合、主题色、暗色模式……） |
| `useDictStore` | 字典缓存 |
| `useLocaleStore` | 当前语言，`set('en-US')` 切换语言 |
| `useNotifyStore` | 铃铛的未读数量、公告和站内信 |
| `useTagsStore` | 顶部的标签页 |

## 样式

- 颜色、圆角、阴影**只能使用 `--qw-*` 变量**（定义在 `src/styles/tokens.css`），不要在组件中写死颜色值；暗色模式会自动切换这些变量；
- Element Plus 的样式覆盖**只能写在** `src/styles/element.css` 中；
- 页面的布局使用这几个类：

| 类 | 用途 |
| --- | --- |
| `qw-page` | 页面的最外层 |
| `qw-search-panel` | 查询条件卡片（自动排成网格） |
| `qw-search-actions` | 查询卡片中"搜索"和"重置"按钮所在的格子 |
| `qw-table-panel` | 表格卡片 |
| `qw-dialog-footer` | 弹框底部的按钮区 |

常用的变量：

| 变量 | 用途 |
| --- | --- |
| `--qw-brand` | 主色 |
| `--qw-text`、`--qw-text-2`、`--qw-text-3` | 正文、次要文字、辅助文字 |
| `--qw-surface`、`--qw-surface-2`、`--qw-canvas` | 卡片背景、次级背景、页面背景 |
| `--qw-border` | 边框 |
| `--qw-success`、`--qw-warning`、`--qw-danger` | 状态颜色 |
| `--qw-radius`、`--qw-radius-sm`、`--qw-radius-lg` | 圆角 |
| `--qw-shadow-1`、`--qw-shadow-2` | 阴影 |
