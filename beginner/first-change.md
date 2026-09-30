# 第一次改代码

这一页做三个小练习，分别修改**界面文字**、**表格**和**校验规则**。每改一处，都马上在浏览器里看到效果。

## 准备

1. 确认 `pnpm dev` 正在运行（参见[第一次把项目跑起来](/beginner/first-run#以后每次怎么启动)）；
2. 用 VS Code 打开项目。在一个**新的**终端窗口里执行：

   ```bash
   cd ~/work/qiwu-vue-admin
   code .
   ```

3. 在浏览器里打开 **系统管理 → 岗位管理**。

::: tip 先保存一个"存档点"
练习会修改项目里的文件。在开始之前，先确认 Git 的状态是干净的：

```bash
git status
```

你应该看到 `nothing to commit, working tree clean`。这样练习做完之后，可以一条命令恢复原样（本页最后会讲）。
:::

## 练习 1：修改菜单名称

**目标**：把侧边栏里的"岗位管理"改成"职位管理"。

在 VS Code 左侧的文件列表中，依次展开：

```text
apps → web → src → locales → zh-CN → iam.position.json
```

::: tip 快速打开文件
按 `⌘ + P`（Windows 上是 `Ctrl + P`），输入文件名 `iam.position.json`，就能直接打开。因为中文和英文各有一个同名文件，注意选择路径里带有 `zh-CN` 的那一个。
:::

文件内容是这样的：

```json
{
  "iam": {
    "position": {
      "entity": "岗位"
    }
  },
  "menu": {
    "iam": {
      "position": "岗位管理"
    }
  }
}
```

把 `"岗位管理"` 改成 `"职位管理"`，按 `⌘ + S`（`Ctrl + S`）保存。

**回到浏览器看看**：侧边栏和标签页上的文字，**不用刷新就已经变了**。这叫"热更新"：保存文件后，Vite 会自动把修改推送到浏览器。

### 为什么文字写在这里，而不是写在页面代码里？

因为这个项目支持中英文切换。页面代码里写的是**翻译键**，比如 `menu.iam.position`，显示的时候再去翻译文件里查对应的文字：

```text
页面代码：t('menu.iam.position')
                  ↓
中文界面 → zh-CN/iam.position.json → "职位管理"
英文界面 → en-US/iam.position.json → "Positions"
```

项目规定：**`.vue` 和 `.ts` 文件里不能直接写中文**，所有文字都要放在翻译文件里，并且**中文和英文都要写**。

## 练习 2：默认隐藏一列

**目标**：岗位列表默认不显示"备注"这一列。

打开 `apps/web/src/views/platform/iam/position/index.vue`，找到 `columns` 这个数组：

```ts
const columns: QwColumn[] = [
  { prop: 'code', label: 'field.iam.position.code', sortable: true, width: 140, showOverflowTooltip: true },
  // …
  { prop: 'note', label: 'field.iam.position.note', minWidth: 120, showOverflowTooltip: true },
]
```

这个数组定义了表格有哪些列。给 `note` 那一行加上 `hidden: true`：

```ts
  { prop: 'note', label: 'field.iam.position.note', minWidth: 120, showOverflowTooltip: true, hidden: true },
```

保存后，看看浏览器：备注列不见了。

点表格右上方的**列设置**按钮，可以看到"备注"还在列表里，只是没有勾选。勾上它，这一列又会出现。**用户自己的列设置会保存下来，下次打开时依然有效。**

::: info 如果备注列没有消失
你之前可能已经调整过这个表格的列设置。在列设置里点"恢复默认"就可以了。
:::

## 练习 3：修改校验规则（前后端一起生效）

**目标**：岗位编码只能包含小写字母和下划线。

这是这个项目最有意思的地方：**校验规则只写一次，前端和后端都会使用它**。

打开 `packages/shared/src/platform/iam/position.schema.ts`，找到：

```ts
export const positionCreate = z
  .object({
    code: z.string().trim().min(1).max(64),
    // …
```

这一行的意思是：`code` 必须是字符串，去掉首尾空格后，长度在 1 到 64 之间。在后面加上一个**正则表达式**规则：

```ts
    code: z.string().trim().min(1).max(64).regex(/^[a-z_]+$/),
```

`/^[a-z_]+$/` 的意思是"从头到尾，只能是小写字母 a 到 z 或者下划线，至少一个字符"。

保存后：

1. 在岗位管理页面点"新增"，编码填 `DEV-01`，点保存。表单上会直接提示"**编码的格式不正确**"，请求根本没有发出去，这是**前端**在校验；
2. 编码改成 `dev_lead`，就能保存成功。

**后端也在用这条规则。** 就算有人绕过页面，直接向服务器发送 `DEV-01`，服务器也会返回 400 错误。这就是"前端检查是为了体验，后端检查是为了安全"。

### 规则写在哪里，生效在哪里

```text
packages/shared/…/position.schema.ts       ← 规则只写在这里
       │
       ├──▶ 前端：表单校验，输入错误立即提示
       └──▶ 后端：接口收到请求时校验，不通过就返回 400
```

## 练习 4：看看后端的代码

不用修改，只是读一读。打开 `apps/server/src/modules/platform/iam/position/position.controller.ts`，找到新增岗位的方法：

```ts
@Post()                                        // 处理 POST /api/iam/positions 请求
@RequirePerm(positionPerms.create)             // 需要"新增岗位"的权限，否则返回 403
@Idempotent()                                  // 3 秒内重复提交，返回 429
@ActionLog({ domain: 'iam.position', verb: 'create', … })   // 记录操作日志
create(@Body({ schema: positionCreate }) dto: PositionCreate) {   // 用 positionCreate 校验请求体
  return this.positions.create(dto)            // 交给服务去保存到数据库
}
```

以 `@` 开头的是**装饰器**，它们像标签一样，给这个方法加上各种功能。就这几行代码，已经包含了权限检查、防重复提交、操作日志和参数校验。

还记得[逛一逛后台](/beginner/admin-tour)里，没有权限的小明看不到"新增"按钮吗？就算他绕过页面直接发送请求，也会被 `@RequirePerm` 拦下来。

## 撤销所有修改

练习做完了，把项目恢复原样：

```bash
git status                # 看看改了哪些文件
git diff                  # 看看具体改了什么
git checkout -- .         # 撤销所有修改（注意最后有一个点）
```

执行 `git status`，又是 `nothing to commit, working tree clean` 了。浏览器里的页面也会自动恢复。

::: warning
`git checkout -- .` 会丢弃**所有**还没有保存到 Git 的修改，而且不能恢复。以后做正式的开发时，要先[用 Git 保存进度](/beginner/git)。
:::

下一步：[做第一个模块：课程管理](/beginner/first-module)。
