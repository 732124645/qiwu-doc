# 做第一个模块：课程管理

这是本教程最重要的一页。我们要从零开始，做一个完整的"**课程管理**"功能：可以新增、修改、删除、搜索、导出课程，并且带有权限控制和操作日志。

你会发现，**大部分代码都不用自己写**，代码生成器会帮你完成。你要做的是：

```text
① 设计数据表  →  ② 写迁移，建表  →  ③ 在代码生成器里配置
      →  ④ 生成代码  →  ⑤ 注册  →  ⑥ 初始化菜单  →  ⑦ 打开页面试用
```

整个过程大约 1 小时。

## ① 设计数据表

先想清楚：一门课程需要记录哪些信息？

| 字段 | 列名 | 类型 | 说明 |
| --- | --- | --- | --- |
| 课程编码 | `code` | 文字，最多 32 个字 | 比如 `CS101`，不能重复 |
| 课程名称 | `name` | 文字，最多 128 个字 | 比如"数据结构" |
| 授课老师 | `teacher` | 文字，最多 64 个字 | 可以不填 |
| 学分 | `credit` | 整数 | 比如 3 |
| 开课日期 | `start_on` | 日期 | 可以不填 |
| 是否启用 | `enabled` | 是 / 否 | 默认"是" |
| 备注 | `note` | 文字，最多 500 个字 | 可以不填 |

除了这些业务字段，**项目里每张表都还要有几个固定的列**：

| 列名 | 作用 |
| --- | --- |
| `id` | 编号，自动递增，唯一标识每一行 |
| `created_by`、`created_at` | 谁、在什么时候创建的（系统自动填写） |
| `updated_by`、`updated_at` | 谁、在什么时候最后修改的（系统自动填写） |
| `deleted_at` | 删除时间。删除时并不会真正删掉数据，而是在这里写上删除时间（叫做"**逻辑删除**"） |
| `alive` | 配合唯一索引使用：课程删除后，它的编码可以被新课程再次使用 |

表名是 `biz_course`。`biz_` 这个前缀表示这是**业务表**，项目要求业务表都用这个前缀。

## ② 写迁移，建表

**迁移**就是"用代码描述对数据库结构的修改"。为什么不直接在数据库里建表？因为你的同学、老师、服务器上各有一个数据库，把建表语句写成代码提交到 Git，大家执行同一条命令，就能得到一模一样的表结构。

在 VS Code 里新建文件：

```text
apps/server/src/db/migrations/20261001100000-biz-course.ts
```

::: tip 文件名的规则
开头是一个时间戳（年月日时分秒），迁移按时间戳的顺序执行。请使用**当前的日期时间**，保证它比文件夹里已有的迁移都晚。
:::

文件内容（可以整段复制）：

```ts
import type { MigrationInterface, QueryRunner } from 'typeorm'

export class BizCourse20261001100000 implements MigrationInterface {
  name = 'BizCourse20261001100000'

  // up：执行迁移时运行，创建表
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE biz_course (
      id bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '课程 ID',
      code varchar(32) NOT NULL COMMENT '课程编码',
      name varchar(128) NOT NULL COMMENT '课程名称',
      teacher varchar(64) NULL COMMENT '授课老师',
      credit int NOT NULL DEFAULT 0 COMMENT '学分',
      start_on date NULL COMMENT '开课日期',
      enabled tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
      note varchar(500) NULL COMMENT '备注',
      created_by bigint unsigned NULL COMMENT '创建人 ID',
      created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
      updated_by bigint unsigned NULL COMMENT '更新人 ID',
      updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
      deleted_at datetime(3) NULL COMMENT '删除时间',
      alive tinyint AS (IF(deleted_at IS NULL, 1, NULL)) VIRTUAL COMMENT '未删除为 1',
      PRIMARY KEY (id),
      UNIQUE KEY uk_biz_course_code (code, alive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课程'`)
  }

  // down：回退迁移时运行，删除表
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE biz_course')
  }
}
```

几个要注意的地方：

- 类名 `BizCourse20261001100000` 和 `name` 的值要一样，末尾的数字和文件名的时间戳一样；
- **`COMMENT` 很重要**：代码生成器会把列的注释当作表单上的字段名称，比如"课程编码"；
- `UNIQUE KEY uk_biz_course_code (code, alive)`：课程编码不能重复（只在没有删除的课程之间比较）。

保存文件，然后在终端里执行迁移（`pnpm dev` 可以继续运行，另开一个终端窗口）：

```bash
cd ~/work/qiwu-vue-admin
pnpm db:migrate
```

你应该在输出的最后看到类似这样的内容：

```text
Migration BizCourse20261001100000 has been executed successfully.
```

## ③ 打开代码生成的写入开关

代码生成器可以把代码**直接写进项目里**。这个功能默认是关闭的，要手动打开。

打开 `apps/server/.env`，找到这一行：

```ini
CODEGEN_WRITE=false
```

改成：

```ini
CODEGEN_WRITE=true
```

保存。**然后重启 `pnpm dev`**：在运行它的那个终端里按 `Ctrl + C`，再执行一次 `pnpm dev`。（环境变量只在启动的时候读取一次，不重启不会生效。）

## ④ 在代码生成器里配置

1. 浏览器打开 **系统工具 → 代码生成**；
2. 点击 **导入表**，在弹出的列表里勾选 `biz_course`，点 **导入选中**；
3. 列表里出现了 `biz_course` 这一行，点这一行的 **编辑**。

现在你看到的是"生成配置"页面，有几个页签。

### 基本信息

检查一下自动识别出来的内容，一般不用修改：

- 领域 `biz`、业务名 `course`：决定了接口地址 `/api/biz/courses` 和权限点 `biz.course.*`；
- 模板：**单表**。

### 字段

这里列出了表里的每一列，你可以决定它在页面上怎么显示：

| 列 | 列表显示 | 查询条件 | 表单显示 | 表单组件 |
| --- | --- | --- | --- | --- |
| code | ✅ | ✅ 包含 | ✅ | 文本框 |
| name | ✅ | ✅ 包含 | ✅ | 文本框 |
| teacher | ✅ | ✅ 包含 | ✅ | 文本框 |
| credit | ✅ | | ✅ | 数字 |
| start_on | ✅ | ✅ 范围 | ✅ | 日期 |
| enabled | ✅ | ✅ 等于 | ✅ | 开关 |
| note | ✅ | | ✅ | **多行文本** |

大部分都已经自动设置好了。把 `note` 的"表单组件"改成**多行文本**，其他的可以按上表调整，也可以保持默认。

### 生成信息

找到 **父菜单**，这决定了新页面出现在侧边栏的哪个分组下面。**请选择"生成示例"**。

::: warning 为什么要手动选择父菜单
`biz_` 开头的表默认挂在一个叫 `biz` 的菜单分组下，但当前版本还没有创建这个分组。如果不修改，后面第 ⑥ 步会报错 `the biz menu group is missing`。
:::

勾选需要的功能：**导出**、**导入**、**详情抽屉**，都可以勾上试试。

### 双语文本

这里是界面上显示的中文和英文。中文已经从列注释里读出来了，英文是根据列名自动生成的，你可以改得更通顺一些，比如把 `Start on` 改成 `Start date`。

点击 **保存**。

## ⑤ 预览并生成代码

回到代码生成列表，点 `biz_course` 这一行的 **预览**。

你会看到生成器准备生成的所有文件，点击左边的文件名可以查看内容。**十几个文件**，包括：

| 位置 | 文件 | 作用 |
| --- | --- | --- |
| 后端 | `course.entity.ts` | 描述数据表的结构 |
| 后端 | `course.service.ts` | 查询和修改数据 |
| 后端 | `course.controller.ts` | 接口：`/api/biz/courses` |
| 后端 | `course.seed.ts` | 菜单和按钮权限 |
| 共享 | `course.schema.ts` | 校验规则和权限常量 |
| 前端 | `index.vue` | 列表页 |
| 前端 | `form.vue` | 新增、编辑弹框 |
| 前端 | `biz.course.json` | 中英文翻译 |
| 测试 | `biz-course.e2e-spec.ts` | 自动化测试 |

预览页面顶部有一段"**生成器不改已有文件，请手工加入以下注册代码**"，**把这段内容复制下来**，下一步要用。

关闭预览，点这一行的 **更多 → 写入工作区**，确认。

你应该看到"**已写入 N 个文件**"。回到 VS Code，在左侧的文件列表里，能看到这些新文件，比如 `apps/server/src/modules/biz/biz/course/`。

::: info 生成器很安全
写入工作区**从不覆盖已经存在的文件**。如果某个文件已经存在并且内容不同，它会列出差异，并且一个文件都不写。所以不用担心把项目弄坏。
:::

## ⑥ 手动注册，初始化菜单

生成器只新建文件，不会修改已有的文件。所以还要手动在 3 个地方加几行代码，告诉项目"有一个新模块"。你刚才复制的注册代码大致是这样的：

**第 1 处：** `apps/server/src/modules/biz/biz.module.ts`

```ts
import { CourseModule } from './biz/course/course.module.js'    // ← 在文件顶部加上这一行

@Module({
  imports: [BookModule, TopicModule, InvoiceModule, DemoRealtimeModule, LeaveModule, CourseModule],
  //                                                                                 ↑ 在最后加上
})
export class BizModule {}
```

**第 2 处：** `apps/server/src/db/seeds/index.ts`

```ts
import { seedCourse } from '../../modules/biz/biz/course/course.seed.js'   // ← 顶部加上

const SEEDS: Record<string, Seed[]> = {
  // …原来的内容不动…
  workflow: [seedWorkflow, seedWorkflowMenus, seedWorkflowTemplates],
  biz: [seedCourse],                                                        // ← 在最后加上这一行
}
```

**第 3 处：** `packages/shared/src/index.ts`

```ts
export * from './biz/biz/course.schema.js'     // ← 在文件末尾加上
```

::: tip 以预览里显示的为准
上面的写法是示意。路径、名称请以你在预览页面复制的注册代码为准。
:::

保存这三个文件。`pnpm dev` 会自动重新编译。然后执行种子，把新菜单和权限写进数据库：

```bash
pnpm db:seed
```

最后没有报错就说明成功了。

## ⑦ 打开页面试用

回到浏览器，**刷新页面**。在侧边栏的 **系统工具 → 生成示例** 下面，出现了"**课程**"菜单。🎉

试试这些功能：

- 点 **新增**，添加几门课程。故意不填课程编码，或者填一个重复的编码，看看会提示什么；
- 在上方的查询条件里，按课程名称搜索；
- 点表头，按学分排序；
- 点 **导出**，下载 Excel 文件；
- 切换到英文界面，看看页面的样子；
- 打开 **日志管理 → 操作日志**，看看刚才的操作有没有被记录。

还记得[逛一逛后台](/beginner/admin-tour)里的"实习生"角色吗？到 **角色管理 → 更多 → 菜单权限** 里，给实习生勾选"课程"的"浏览"，再用小明登录，看看他能不能看到课程，能不能修改。

## 你刚才做了什么

你只写了**一个迁移文件**和**几行注册代码**，就得到了一个完整的功能：

- ✅ 列表、搜索、分页、排序；
- ✅ 新增、编辑、删除、批量删除；
- ✅ Excel 导出和导入；
- ✅ 前后端一致的输入校验；
- ✅ 菜单权限和按钮权限；
- ✅ 操作日志；
- ✅ 中英文界面；
- ✅ 自动化测试。

最后，跑一下生成的测试，看看全部能不能通过（测试需要一个单独的测试数据库，第一次运行前要先创建，参见[写测试](/backend/testing#测试用的数据库)）：

```bash
pnpm --filter @qiwu/server test biz-course.e2e
```

## 接下来可以试试

- 在 `course.service.ts` 里加一条业务规则：**学分不能超过 10**；
- 给课程加一个"**课程类型**"字段，用字典做成下拉框（参见[字典](/core/dict)）；
- 跟着[手把手：加一个自定义操作](/backend/tutorial)，给课程加一个"停课"按钮。

别忘了[用 Git 保存进度](/beginner/git)！
