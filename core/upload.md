# 文件上传

::: tip 后台怎么用
这一页讲写代码。后台页面能做什么、各项设置的含义，见[文件管理](/features/storage)。
:::

## 最常见的情况：表单里上传一张图片

以图书示例的"封面"为例。数据库里只需要一个普通的字符串列，用来保存图片地址：

```ts
// book.entity.ts
/** 封面图片地址 */
@Column({ name: 'cover_url', type: 'varchar', length: 512, nullable: true })
coverUrl: string | null
```

表单里使用 `ImageUpload` 组件，再用 `uploadField` 把它和这个字符串字段绑定起来：

```vue
<script setup lang="ts">
import ImageUpload from '@/core/components/ImageUpload.vue'
import { uploadField } from '@/core/composables/use-upload'

// 一列保存一个上传：图片保存它的公开地址
const coverUrlFiles = uploadField(model, 'coverUrl', 'image')
</script>

<template>
  <el-form-item :label="t('field.demo.book.coverUrl')" prop="coverUrl">
    <ImageUpload v-model="coverUrlFiles" biz-tag="cover" />
  </el-form-item>
</template>
```

**后端不需要写任何代码。** 图片由上传接口单独保存，表单提交时只提交地址字符串。代码生成器里把某一列的控件选为"图片上传"或"文件上传"，就会生成上面这样的代码。

## 公开和私有

上传时要指定一个**业务标签** `bizTag`，它决定文件是公开的还是私有的：

| 标签 | 公开 / 私有 | 用途 |
| --- | --- | --- |
| `avatar` | 公开 | 头像 |
| `cover` | 公开 | 封面图片 |
| `richtext` | 公开 | 富文本里插入的图片 |
| `attachment` | 私有 | 附件（**组件的默认值**） |
| `import` | 私有 | 导入的文件 |
| `wf.attachment` | 私有 | 流程表单的附件（表单设计器里的"附件"组件） |

- **公开文件**：只允许图片（png、jpeg、gif、webp）。有一个固定的地址 `/files/…`，不需要登录就能访问，可以直接放进 `<img src>`；
- **私有文件**：没有公开地址，必须带着登录令牌通过 `GET /api/storage/objects/:id/download` 下载。

::: warning 标签列表是固定的
业务标签在共享包的 `STORAGE_PUBLIC_TAGS` / `STORAGE_PRIVATE_TAGS` 中定义。需要新的标签时，要修改这两个常量。
:::

## 上传附件（私有文件）

```ts
const attachmentFiles = uploadField(model, 'attachment', 'file')
```

```vue
<FileUpload v-model="attachmentFiles" biz-tag="attachment" accept=".pdf,.docx" />
```

私有文件保存到字符串列里的格式是 `<文件id>/<原始文件名>`，比如 `128/合同.pdf`。

## 组件属性

`ImageUpload` 和 `FileUpload` 的 `v-model` 都是文件对象数组。

| 属性 | ImageUpload 默认值 | FileUpload 默认值 | 说明 |
| --- | --- | --- | --- |
| `biz-tag` | `attachment` | `attachment` | 业务标签 |
| `limit` | 1 | 10 | 最多几个文件 |
| `max-size` | 跟随参数 | 跟随参数 | 单个文件的大小上限（字节），见下文 |
| `direct` | `false` | `false` | 浏览器直传到 S3（需要先配置 S3 存储） |
| `disabled` | `false` | `false` | |
| `accept` | 没有这个属性（固定只能选 PNG、JPEG、GIF、WebP 图片，传了也不起作用） | 不限 | 只影响文件选择框，服务端还会再检查一次 |

在组件里点"删除"，只是把文件从列表中移除，**已经上传的文件本身不会被删除**。

### 大小上限

组件在发送前检查大小，只是为了尽快提示，服务端还会再查一次（超过返回 413）。上限按这个顺序决定：

1. 传了 `max-size`，就用它；
2. 没传，就用参数 `storage.max_size_mb`。这是一个"登录前可读"的参数，组件通过 `GET /api/settings/params/public/storage.max_size_mb` 读取，**浏览器加载一次只读一次**（切换路由不会重读），所有上传组件共用结果；
3. 读不到参数（网络出错、参数没有设为登录前可读）时，按 `STORAGE_MAX_SIZE_DEFAULT`（20 MB）。

组件下方的提示文字（"单个不超过 …"）显示的就是最终的上限。参数值的解析规则和服务端一样：1–2048 之间的整数，否则按 20 MB，都在共享包的 `storageMaxBytes()` 里。

一般**不要传 `max-size`**，让它跟随参数，管理员调大参数后，页面刷新就跟着变。只有某个字段需要比全局更小的上限时才传，比如：

```vue
<!-- 这个字段最多 5 MB，不受参数影响 -->
<FileUpload v-model="attachmentFiles" :max-size="5 * 1024 * 1024" />
```

传的值大于服务端上限也没用，超出的部分照样被服务端拒绝。

自己用 `el-upload` 或别的方式上传、又想提前检查时，可以直接拿到同一个上限（字节）：

```ts
import { uploadMaxSize } from '@/core/composables/use-upload'

const max = await uploadMaxSize() // 读不到参数时是 20 MB
```

表单设计器的"附件"组件有"单个文件上限（MB）"设置，填了就作为 `max-size` 传给 `FileUpload`，不填就跟随参数。移动端的 `QwUpload`（`mobile/src/core/components/QwUpload.vue`）规则相同，只是每次启动应用读一次参数。

## 服务端做了哪些检查

上传接口是 `POST /api/storage/objects`（multipart，字段是 `bizTag` 和 `file`），任何已登录用户都可以调用。每个文件都会经过：

1. 大小检查（参数 `storage.max_size_mb`，默认 20 MB，超过返回 413）；
2. 扩展名白名单（参数 `storage.allowed_exts`）。`html`、`svg`、`js`、`xml` 等**永远不允许**；
3. **按文件内容判断真实类型**，而不是相信扩展名。改了扩展名的文件会被拒绝；
4. 使用随机文件名保存，路径是 `yyyy/MM/dd/<uuid>.<扩展名>`。

每个 IP 每分钟最多上传 60 次。计数存在 Redis 里，部署了多个实例时按所有实例合计，见[防重复提交、限流与锁](/core/guards)。

## 显示私有图片

`<img>` 标签没法带上登录令牌，所以私有图片要先下载成 Blob，再生成一个临时地址：

```ts
import { storageApi } from '@/api/platform/storage/object'

const url = URL.createObjectURL(await storageApi.blob(fileId))
// 不再使用时释放：URL.revokeObjectURL(url)
```

`ImageUpload` 组件已经自动处理了这一点。

## 谁可以下载私有文件

默认按这个顺序判断：上传者本人 → 超级管理员 → 拥有 `storage.object.view` 权限的人 → 业务模块注册的检查器。

业务模块可以为自己的标签注册一个检查器，比如"审批人可以下载申请人上传的附件"：

```ts
// 注入 StorageAccess，在模块初始化（onModuleInit）时注册；一个标签只能注册一个检查器
this.storageAccess.register('my-tag', async (obj, principal) => {
  return /* 这个 principal 能否访问 obj */
})
```

工作流模块就是这样控制流程附件（`wf.attachment`）的：能查看这个流程实例、并且能看到引用这个文件的表单字段的人，才能下载（见 `modules/workflow/workflow.module.ts`）。

上传后，业务模块还可以在**同一个事务**里用 `StorageService.bindRefs(文件id列表, 标签, 业务引用, 上传人id, 事务)` 把文件绑定到业务记录（工作流用的引用是 `wf:<实例id>`）。它只绑定本人上传、标签一致、还没被绑定过的文件；有一个不符合就抛出 `C1009`，整个事务回滚。这样别人就不能拿你上传的文件 id 冒用。
