# 富文本

富文本就是"可以设置格式的正文"，比如公告内容、邮件模板。它本质上是 HTML，所以也是 **XSS 攻击**最常见的入口：如果有人在正文里插入一段 `<script>`，其他人打开这条公告时，这段脚本就会在他们的浏览器里执行。

项目的做法是：**保存时由服务端清洗，只保留白名单内的标签和属性。**

## 前端：RichEditor

```vue
<script setup lang="ts">
import RichEditor from '@/core/components/RichEditor.vue'
</script>

<template>
  <el-form-item :label="t('field.messaging.bulletin.body')" prop="body">
    <!-- 内容是 HTML；服务端保存时会按白名单清洗 -->
    <RichEditor v-model="model.body" :height="320" />
  </el-form-item>
</template>
```

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `v-model` | `''` | HTML 字符串 |
| `height` | 360 | 编辑区高度（像素） |
| `placeholder` | `''` | |
| `disabled` | `false` | |

- 插入的图片会上传为公开文件（业务标签 `richtext`），正文里只保存图片地址，**不会把图片转成 base64 存进正文**；
- 工具栏只保留了能通过服务端清洗的功能，所以没有颜色、字体、字号、对齐和视频；
- 切换界面语言时，编辑器的语言会跟着切换，内容不会丢失。

## 后端：保存时清洗

```ts
// bulletin.service.ts
import { sanitizeRichText } from '../../../../core/sanitize.js'

/** 保存的正文：无论客户端发来什么，都只保留白名单内的内容 */
const cleanBody = <T extends { body?: unknown }>(dto: T): T =>
  typeof dto.body === 'string' ? { ...dto, body: sanitizeRichText(dto.body) } : dto

override create(dto: DeepPartial<Bulletin>): Promise<Bulletin> {
  return super.create(cleanBody(dto))
}

override update(id: number, dto: QueryDeepPartialEntity<Bulletin>): Promise<void> {
  return super.update(id, cleanBody(dto))
}
```

有多个富文本字段时，可以用 `sanitizeFields(dto, ['body', 'summary'])`，它会清洗指定的字符串字段，并返回一个新对象。

**白名单**（`core/sanitize.ts`，固定的，不能在运行时修改）：

- 不允许 `style`、`class`、`id` 和任何 `on*` 事件属性；
- 不允许 `script`、`style`、`iframe`、`object`、`form`、`svg` 和音视频标签；
- 链接只允许 `http`、`https`、`mailto`；图片只允许 `http`、`https`（不允许 `data:`）；
- 所有链接会自动加上 `rel="noopener noreferrer"`。

::: warning 一定要在服务端清洗
前端编辑器能产生什么内容并不重要，因为攻击者可以绕过编辑器，直接调用接口提交任意 HTML。**清洗必须在服务端保存时进行。**
:::

## 显示富文本

显示时要用 `v-html`。**只有已经在服务端清洗过的内容才能用 `v-html`**，并且要在旁边写注释说明内容来源。项目里公告详情是这样写的：

```vue
<!-- sanitized when saved (core/sanitize.ts whitelist): the bulletin body is the one v-html source -->
<div class="bulletin-view__body" v-html="bulletin.body" />
```

用户输入的普通文本（比如站内信）一律用 `{{ }}` 显示，Vue 会自动转义。

代码生成器里把一列的控件设为"富文本"时，生成的服务会在保存和读取详情时都做清洗。
