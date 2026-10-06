---
description: '新增和编辑共用的表单弹框：useCrudForm 用共享 zod 规则校验、加载和提交，openDialog 以 Promise 方式打开弹框，以及只在新增时显示的字段。'
---

# 表单弹框

项目中新增和编辑都使用**同一个表单组件**，并在弹框里打开。

## 表单组件

```vue
<!-- views/platform/iam/position/form.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { positionCreate } from '@qiwu/shared'
import { positionApi } from '@/api/platform/iam/position'
import { useCrudForm } from '@/core/composables/use-crud'

defineOptions({ name: 'IamPositionForm' })
const { id } = defineProps<{ id?: number }>()                        // 有 id 是编辑，没有是新增
const emit = defineEmits<{ done: [saved: { id: number }]; cancel: [] }>()
const { t } = useI18n()

const { model, formRef, rules, loading, submitting, submit } = useCrudForm({
  api: positionApi,
  schema: positionCreate,                                             // 共享包里的 zod 规则
  emptyModel: () => ({ code: '', name: '', sortNo: 0, enabled: true, note: '' }),
  id,
  emit,
})
</script>

<template>
  <el-form ref="formRef" v-loading="loading" :model="model" :rules="rules" label-position="left">
    <el-form-item :label="t('field.iam.position.code')" prop="code">
      <el-input v-model="model.code" maxlength="64" />
    </el-form-item>
    <el-form-item :label="t('field.iam.position.sortNo')" prop="sortNo">
      <el-input-number v-model="model.sortNo" :min="0" :max="999999" controls-position="right" />
    </el-form-item>
    <el-form-item :label="t('field.iam.position.enabled')" prop="enabled">
      <el-switch v-model="model.enabled" />
    </el-form-item>
  </el-form>
  <div class="qw-dialog-footer">
    <el-button @click="emit('cancel')">{{ t('common.action.cancel') }}</el-button>
    <el-button type="primary" :loading="submitting" @click="submit">{{ t('crud.action.save') }}</el-button>
  </div>
</template>
```

## useCrudForm 做了什么

| 参数 | 说明 |
| --- | --- |
| `api` | 需要有 `get`、`create`、`update` 三个方法（`crudApi()` 生成的对象就有） |
| `schema` | zod 规则，会自动转换成 Element Plus 的表单校验规则 |
| `emptyModel` | 新增时的初始值。**只有这里列出的字段才会被编辑和提交** |
| `id` | 有值时先调用 `get(id)` 加载数据 |
| `emit` | 组件的 emit，保存成功后触发 `done`，加载失败时触发 `cancel` |

返回值：

| 返回 | 说明 |
| --- | --- |
| `model` | 表单数据，绑定到 `el-form` |
| `formRef` | 绑定到 `el-form` 的 `ref` |
| `rules` | 由 zod 规则生成的校验规则，错误提示已经翻译好了 |
| `loading` | 编辑时正在加载数据 |
| `submitting` | 正在提交，绑定到保存按钮的 `loading` |
| `submit` | 校验 → 调用 create 或 update → 触发 `done` |
| `row` | 编辑时加载到的原始数据 |

**校验规则和后端完全一致**，因为用的是共享包里的同一个 zod 规则。前端校验只是为了让用户早点看到错误，后端还会再校验一遍。

## 打开弹框

在列表页中：

```ts
import { openDialog } from '@/core/dialog'
import PositionForm from './form.vue'

async function openForm(id?: number) {
  const saved = await openDialog(
    PositionForm,
    { id },                                           // 传给表单组件的 props
    { title: () => t(id ? 'crud.title.edit' : 'crud.title.create', { name: t('iam.position.entity') }) },
  )
  if (saved) await refresh()                         // 保存成功才刷新
}
```

`openDialog(组件, props, 选项)` 返回一个 Promise：

- 表单触发 `done(结果)` → Promise 返回这个结果；
- 用户点取消、关闭按钮、按 ESC（`closeOnPressEscape` 为 `false` 时除外）或者切换了路由 → 返回 `undefined`。

所以打开弹框、等待结果，就像调用一个普通的异步函数一样。

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `title` | | 标题。传入一个函数时，切换语言后标题也会更新 |
| `width` | `520px` | 宽度 |
| `closeOnRouteChange` | `true` | 切换路由时是否自动关闭 |
| `closeOnPressEscape` | `true` | 按 ESC 是否关闭。弹框里的工作会丢失时（比如嵌入了表单设计器）设为 `false` |
| `top` | `15vh` | 弹框离页面顶部的距离。很高的弹框可以设小一些，免得在小屏幕上放不下 |

## 只在新增时显示的字段

比如新增用户时要填写初始密码，编辑时不需要：

```vue
<el-form-item v-if="id == null" :label="t('field.iam.user.password')" prop="password">
  <el-input v-model="model.password" type="password" show-password />
</el-form-item>
```

## 其他弹框内容

`openDialog` 不只能打开表单。任何组件只要声明了 `done` 和 `cancel` 两个事件，都可以放进弹框里，比如"重置密码"、"选择用户"：

```ts
const emit = defineEmits<{ done: [result: MyResult]; cancel: [] }>()
```
