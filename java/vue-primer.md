# 前端速成：Vue 3

这一页的目标不是让你成为前端专家，而是让你**能看懂、能修改代码生成器生成的页面**。大部分页面都是生成的，你通常只需要加一个按钮、一个字段，或者改一下显示方式。

如果你用过 RuoYi 的 Vue 2 前端，要注意：本项目用的是 **Vue 3 的 `<script setup>` 写法**，和 Vue 2 的 `data()`、`methods` 写法差别比较大。

## 一个页面文件长什么样

Vue 的页面是 `.vue` 文件，一个文件包含三部分：

```vue
<script setup lang="ts">
// ① 逻辑：TypeScript
import { ref, computed } from 'vue'

const count = ref(0)                              // 响应式变量
const double = computed(() => count.value * 2)    // 计算属性
function add() {
  count.value++
}
</script>

<template>
  <!-- ② 模板：类似 HTML，变量会自动绑定 -->
  <el-button @click="add">+1</el-button>
  <span>{{ count }} × 2 = {{ double }}</span>
</template>

<style scoped>
/* ③ 样式：只作用于当前组件 */
</style>
```

**核心思想：数据变了，页面自动更新。** 你只需要修改变量，不需要自己操作 DOM。可以把它理解成，模板一直绑定在这些变量上，变量一变，页面就跟着重新渲染。

## 响应式变量

```ts
import { ref, reactive, computed, watch } from 'vue'

const loading = ref(false)                 // 基本类型用 ref，在 script 里读写要加 .value
loading.value = true

const query = reactive({ code: '', page: 1 })   // 对象可以用 reactive，不需要 .value
query.code = 'dev'

const canEdit = computed(() => perm.has(positionPerms.modify))   // 由其他变量计算出来，自动更新

watch(() => query.code, (v) => console.log('code 变了', v))      // 监听变化
```

::: tip .value 什么时候要写
在 `<script>` 里访问 `ref` 变量要写 `.value`；在 `<template>` 里**不用写**，Vue 会自动处理。
:::

## 模板语法

| 写法 | 作用 | 例子 |
| --- | --- | --- |
| <code v-pre>{{ x }}</code> | 显示变量 | <code v-pre>{{ row.name }}</code> |
| `:prop="x"` | 把变量绑定到属性（`v-bind` 的缩写） | `:loading="submitting"` |
| `@event="fn"` | 监听事件（`v-on` 的缩写） | `@click="openForm()"` |
| `v-model="x"` | 双向绑定：输入框的值和变量同步 | `v-model="model.code"` |
| `v-if="cond"` | 条件为真时才渲染 | `v-if="id == null"` |
| `v-show="cond"` | 条件为假时隐藏（元素仍然存在） | `v-show="showSearch"` |
| `v-for="x in list"` | 循环 | `v-for="o in options" :key="o.value"` |
| `v-perm="perm"` | 本项目的权限指令 | `v-perm="positionPerms.create"` |

注意 `:` 的作用：`loading="true"` 传入的是字符串 `"true"`，`:loading="true"` 传入的才是布尔值 `true`。

## 组件：props 和事件

组件就像一个可以复用的"自定义标签"。父组件通过 **props** 把数据传给子组件，子组件通过**事件**把结果通知父组件：

```vue
<!-- 子组件 form.vue -->
<script setup lang="ts">
const { id } = defineProps<{ id?: number }>()                       // 接收参数
const emit = defineEmits<{ done: [saved: { id: number }]; cancel: [] }>()  // 声明事件

function onSaved(saved: { id: number }) {
  emit('done', saved)                                               // 通知父组件
}
</script>
```

```vue
<!-- 父组件中使用 -->
<PositionForm :id="3" @done="refresh" @cancel="close" />
```

类比 Java：props 相当于构造函数参数，事件相当于回调。

## 组合式函数（composable）

以 `use` 开头的函数，把一组相关的状态和逻辑封装在一起，可以在多个页面中复用。本项目的列表页和表单就是靠它们实现的：

```ts
const { query, rows, total, loading, search, refresh } = useCrudList({ api: positionApi, … })
const { model, rules, submitting, submit } = useCrudForm({ api: positionApi, schema: positionCreate, … })
```

可以把它理解为"一个有状态的工具类"。详见[列表页](/core/crud-list)和[表单弹框](/core/crud-form)。

## Element Plus：UI 组件库

页面上的按钮、表格、表单、弹框，都来自 Element Plus。所有组件都以 `el-` 开头：

```vue
<el-form :model="model" :rules="rules">
  <el-form-item label="编码" prop="code">
    <el-input v-model="model.code" />
  </el-form-item>
  <el-form-item label="启用" prop="enabled">
    <el-switch v-model="model.enabled" />
  </el-form-item>
</el-form>
```

需要什么组件、有哪些属性，直接查阅 [Element Plus 官方文档](https://element-plus.org/zh-CN/component/overview.html)。后台的 **系统工具 → Element Plus 文档** 菜单也可以打开它。

## 调用接口

每个模块都有一个接口文件，比如 `src/api/platform/iam/position.ts`：

```ts
export const positionApi = {
  ...crudApi<PositionVo, PositionCreate>('/iam/positions'),   // page、get、create、update、remove、exportFile
  setEnabled: (id: number, enabled: boolean) => api.put(`/iam/positions/${id}/enabled`, { enabled }),
}
```

在页面中调用：

```ts
const row = await positionApi.get(3)              // 返回的就是 data 部分，类型是 PositionVo
await positionApi.setEnabled(3, false)
```

请求层已经处理好了：自动带上令牌、令牌过期时自动刷新、出错时自动弹出后端返回的错误信息。**通常不需要自己写 try/catch。**

类型 `PositionVo`、`PositionCreate` 来自共享包，和后端是同一份定义。后端改了字段，前端会直接出现编译错误。

## 路由和菜单

页面的路由**不是在前端写死的**，而是登录后由后端下发（`GET /api/auth/menus`）。菜单记录里的 `component` 字段对应 `src/views/` 下的文件路径：

```text
菜单：component = 'platform/iam/position/index'
  →  文件：src/views/platform/iam/position/index.vue
```

所以**新增一个页面 = 新建 `.vue` 文件 + 在种子里加一条菜单记录**。代码生成器会同时生成这两样。

## 项目的前端约定

- **不能写中文**：页面上的文字一律用 `t('翻译键')`，翻译写在 `src/locales/` 里。参见[权限与翻译](/core/web-perm-i18n)；
- **不能写死颜色**：颜色、圆角、阴影只能使用 `--qw-*` CSS 变量；
- **提交按钮**在请求期间要显示 loading 并禁用；
- 新页面放在 `src/views/<领域>/` 下，接口文件放在 `src/api/<领域>/` 下，比如 `views/crm/customer/`、`api/crm/customer.ts`。

## 去哪里找示例

| 想做什么 | 参考文件 |
| --- | --- |
| 最简单的列表 + 表单 | `src/views/platform/iam/position/` |
| 带图片上传、字典、部门的表单 | `src/views/demo/book/` |
| 树形表格 | `src/views/demo/topic/` |
| 主子表（一张单据带多行明细） | `src/views/demo/invoice/` |
| 复杂页面（左侧部门树、详情抽屉、更多操作） | `src/views/platform/iam/user/` |
| 接入审批流程的业务表单 | `src/views/biz/leave/` |

改一改这些示例，是最快的学习方法。
