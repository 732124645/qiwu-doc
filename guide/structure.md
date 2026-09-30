# 目录结构

这是一个 pnpm workspace 单仓库，包含三个包：

```text
qiwu-vue-admin/
├─ apps/
│  ├─ server/          # @qiwu/server  NestJS 后端
│  └─ web/             # @qiwu/web     Vue 3 前端
├─ packages/
│  └─ shared/          # @qiwu/shared  前后端共享：zod 规则、类型、错误码、权限常量
├─ scripts/            # 检查脚本（许可证、国际化、原创性、分层架构……）
└─ docs/               # 内部开发文档（计划、架构决策记录）
```

## 后端 `apps/server`

```text
src/
├─ core/               # 框架层：认证、权限、数据范围、数据库、国际化、Redis、审计、实时推送……
├─ modules/
│  ├─ platform/        # 平台模块：iam（用户/角色/菜单/部门/岗位）、settings、messaging、
│  │                   #           audit、storage、scheduler、codegen、monitor、geo
│  ├─ workflow/        # 工作流：引擎、模型、运行时、审批中心、管理
│  └─ biz/             # 你的业务代码放这里；biz.module.ts 是唯一的注册入口
├─ i18n/{zh-CN,en-US}/ # 后端消息翻译
└─ db/
   ├─ migrations/      # 数据库迁移（只用迁移改表，从不自动同步）
   └─ seeds/           # 种子数据：菜单、权限、字典、默认账号……
codegen-templates/     # 代码生成器模板（EJS）
test/                  # e2e 测试
```

### 分层规则

分层依赖由 lint 规则强制检查，违反时 `pnpm verify` 会失败：

| 层 | 可以依赖 | 不可以依赖 |
| --- | --- | --- |
| `core` | 第三方包 | 任何 `modules` |
| `platform` | `core` | `workflow`、`biz` |
| `workflow` | `core`、`platform` | `biz` |
| `biz` | 以上全部 | — |

所以**新项目的业务代码只放在 `modules/biz` 和 `views/biz` 里**。这样以后升级模板时，平台部分和你的业务代码冲突最少。

### 一个模块长什么样

以岗位为例，所有模块（包括生成器产出的）都是同一个结构：

```text
apps/server/src/modules/platform/iam/position/
  position.entity.ts       # 实体
  position.service.ts      # 继承 BaseCrudService，只覆写需要的方法
  position.controller.ts   # 路由 + 权限 + 操作日志
  position.module.ts
  position.seed.ts         # 菜单和权限点
packages/shared/src/platform/iam/position.schema.ts   # zod：新增/修改/查询/返回 + positionPerms
apps/server/test/e2e/iam-position.e2e-spec.ts         # e2e 测试
```

## 前端 `apps/web`

```text
src/
├─ core/               # 布局、路由、请求、状态、权限指令、国际化、通用组件
├─ views/{platform,workflow,biz}/    # 页面
├─ api/{platform,workflow,biz}/      # 接口封装
├─ locales/{zh-CN,en-US}/            # 界面翻译
└─ styles/             # 设计令牌（--qw-*）与 Element Plus 覆盖
e2e/                   # Playwright 测试
```

- **路由由后端下发**：登录后调用 `GET /api/auth/menus`，前端按用户实际拥有的菜单动态注册路由。没有权限的页面不会注册，直接访问会显示 404。
- **CRUD 页面**使用 `QwTable`（按列数组渲染，用户可以自定义显示哪些列、列的顺序）、`TableToolbar`、`useCrudList`、`useCrudForm`。新增和编辑用弹框：`await openDialog(Form, { id }, { title })`。
- **颜色、圆角、阴影**只能使用 `--qw-*` 令牌，组件里不要写死颜色值。

## 共享包 `packages/shared`

前后端都从这里导入：

- 每个模块的 zod 规则：新增、修改、查询、返回
- 权限常量，比如 `userPerms.create === 'iam.user.create'`
- 错误码、枚举码
- 校验提示文案（`validation.*`）和字段名（`field.*`）的翻译

后端用这些规则校验请求并生成 Swagger 文档，前端用同一份规则校验表单。**改一处，两端同时生效。**
