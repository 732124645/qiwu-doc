# 从 RuoYi 过来

如果你用过 RuoYi（或者基于它的芋道等框架），这个项目的功能你基本都熟悉：用户、角色、菜单、部门、岗位、字典、参数、日志、定时任务、代码生成……

但要注意两点：

1. **代码是完全独立编写的**，表名、接口路径、权限写法、字典编码都不一样，**接口协议也不兼容**。不能把 RuoYi 的前端直接接到这个后端上；
2. 有些地方是**有意设计得不同**的，主要是出于安全考虑。下面会逐一说明。

## 概念对照

### 权限

::: code-group

```java [RuoYi]
@PreAuthorize("@ss.hasPermi('system:user:list')")
@GetMapping("/list")
public TableDataInfo list(SysUser user) { … }
```

```ts [本项目]
@Get()
@RequirePerm(userPerms.browse)            // 'iam.user.browse'
page(@Query({ schema: userQuery }) query: UserQuery) { … }
```

:::

| RuoYi | 本项目 |
| --- | --- |
| 权限写法 `system:user:list` | `iam.user.browse`（`<域>.<资源>.<动作>`） |
| 权限字符串直接写在注解里 | 写在共享包的常量里（`userPerms.browse`），前后端共用 |
| 前端 `v-hasPermi="['system:user:add']"` | `v-perm="userPerms.create"` |
| 超级管理员 `admin`（用户 id 为 1） | 编码为 `root` 的内置角色，不依赖 id |
| 菜单类型 M / C / F | `group` / `page` / `action` |

常用的动作：`browse`（列表）、`view`（详情）、`create`、`modify`、`remove`、`export`、`import`。

**不同之处：防越权授予。** 非超级管理员不能把**自己没有的权限**授予别人，也不能分配**数据范围比自己大**的角色。RuoYi 默认不做这个限制。参见[权限与数据范围](/features/permission#防越权授予)。

### 数据权限

::: code-group

```java [RuoYi]
// Service 方法上声明，并在 Mapper XML 里拼接 ${params.dataScope}
@DataScope(deptAlias = "d", userAlias = "u")
public List<SysUser> selectUserList(SysUser user) { … }
```

```ts [本项目]
// 在实体上声明一次
@DataScoped({ dept: 'dept_id', owner: 'created_by' })
@Entity('crm_customer')
export class Customer extends BaseEntity { … }
// 之后所有读取经过 scopedQb()、所有修改经过 lockScopedIds()，都会自动加上条件
```

:::

| RuoYi | 本项目 |
| --- | --- |
| 在每个查询方法上加注解，再在 SQL 里拼接 | 在实体上声明一次，**读取和修改都自动生效** |
| 主要控制列表查询 | 列表、详情、导出、下拉选项、**修改、删除**都受控制 |
| 超出范围：查不到 | 超出范围：统一返回 **404**，不泄露记录是否存在 |
| 全部 / 自定义 / 本部门 / 本部门及以下 / 仅本人 | `all` / `picked_depts` / `own_dept` / `own_dept_tree` / `own_rows` |

**不同之处：修改和删除也检查数据范围。** 按 id 修改或删除时，会先确认这条记录在当前用户的数据范围内。这可以防止"改一下请求里的 id，就能修改别人部门的数据"这类越权漏洞（IDOR）。

### 统一返回格式

| RuoYi | 本项目 |
| --- | --- |
| `AjaxResult.success(data)` | 直接 `return data`，由拦截器包装 |
| `{ code: 200, msg, data }` | `{ code: 0, msg, data }` |
| `TableDataInfo { total, rows, code, msg }` | `data: { items, total }` |
| `startPage()`（PageHelper） | `page(query)`，参数为 `page`、`pageSize`、`sort` |
| 出错时 HTTP 状态码仍为 200 | 使用**真实的 HTTP 状态码**（400 / 401 / 403 / 404 / 409 / 422 / 429） |
| `throw new ServiceException("中文信息")` | `throw new BizError(错误码, 参数)`，信息按请求语言翻译 |

### 操作日志和防重复提交

| RuoYi | 本项目 |
| --- | --- |
| `@Log(title = "用户管理", businessType = BusinessType.INSERT)` | `@ActionLog({ domain: 'iam.user', verb: 'create' })` |
| 可以不加 | **每个非 GET 接口都必须加**，或者显式声明 `@SkipActionLog()`，否则检查不通过 |
| `@RepeatSubmit` | `@Idempotent()` |
| `@RateLimiter(time = 60, count = 10)` | `@RateLimit(10, 60_000)` |

### 当前用户

| RuoYi | 本项目 |
| --- | --- |
| `SecurityUtils.getUserId()` | `clsGet('principal')?.userId` |
| `getLoginUser()` | `clsGet('principal')` |
| `BaseEntity.createBy`（用户名） | `created_by`（用户 id），自动填写 |

### 登录和令牌

| RuoYi | 本项目 |
| --- | --- |
| JWT（里面是一个 uuid）+ Redis `login_tokens:{uuid}` | 随机的不透明令牌，Redis 中只保存它的哈希值 |
| 一个令牌 | 访问令牌（30 分钟，存在内存里）+ 刷新令牌（HttpOnly cookie，每次使用后更换） |
| 令牌存在 cookie 里，JS 可以读取 | JS 无法读取刷新令牌 |
| "记住密码"（加密存在 cookie 里） | **不提供**。改为"记住用户名"和"保持登录" |

"记住密码"把密码保存在浏览器里，属于安全上的反模式，所以这个项目没有这个功能。参见[登录是怎么回事](/backend/auth)。

### 实体和逻辑删除

| RuoYi | 本项目 |
| --- | --- |
| `BaseEntity`：createBy、createTime、updateBy、updateTime、remark | `BaseEntity`：createdBy、createdAt、updatedBy、updatedAt（没有公共的 remark） |
| `del_flag`：`'0'` 存在、`'2'` 删除 | `deleted_at`：为空表示存在，有值表示删除时间 |
| 有外键 | **没有外键**，引用关系在应用层检查（被引用时删除返回 409） |
| 唯一索引 | 唯一索引加上 `alive` 列，删除后编码可以重新使用 |
| 时间按服务器时区存储 | 统一存储 **UTC** 时间 |

### 字典和参数

| RuoYi | 本项目 |
| --- | --- |
| `sys_dict_type` / `sys_dict_data` | `cfg_dict` / `cfg_dict_entry` |
| 字典类型 `sys_user_sex` | 字典编码 `iam.gender`（用点分隔） |
| 字典标签只有一种语言 | `label_i18n`：每种语言各一份 |
| 前端 `useDict('sys_user_sex')` + `<dict-tag>` | `useDict('iam.gender')` + `<DictTag>` |
| `sys_config` + `selectConfigByKey(key)` | `cfg_param` + `ParamService.get(key)` / `int(...)` |

### 定时任务

| RuoYi | 本项目 |
| --- | --- |
| Quartz | `@nestjs/schedule` |
| 调用目标是字符串 `ryTask.ryParams('ry')`，通过反射调用 | **只能选择白名单中的处理器**，参数是 JSON，并用 zod 校验 |
| 并发执行：允许 / 禁止 | `allow_overlap` |
| 错过策略：立即执行 / 执行一次 / 放弃 | `run_once` / `skip` |

"调用目标"写成字符串再反射调用，存在执行任意方法的风险。这个项目改为：处理器必须在代码里用 `@JobHandler` 声明，页面上只能从下拉框中选择。参见[定时任务](/core/job)。

### Excel

| RuoYi | 本项目 |
| --- | --- |
| 实体字段上的 `@Excel(name = "用户名")` 注解 | 单独定义一个列数组 `ExcelColumn[]`，表头是翻译键 |
| `ExcelUtil<SysUser>` | `ExcelService` 的 `export` / `template` / `read` |
| `readConverterExp = "0=男,1=女"` | 列上写 `dict: 'iam.gender'`，自动转换，支持多语言 |
| — | 导出时自动转义公式；导入时限制大小和行数，拒绝包含宏的文件 |

### 代码生成

| RuoYi | 本项目 |
| --- | --- |
| Velocity 模板 | EJS 模板 |
| 下载 zip 后手动复制到项目里 | 可以下载 zip，也可以用 `pnpm gen write` **直接写入仓库**（从不覆盖已有文件） |
| 单表 / 树表 / 主子表 | 单表 / 树表 / 主子表 |
| 生成 Java + XML + Vue + SQL | 生成实体、服务、控制器、共享 zod 规则、Vue 页面、菜单种子、翻译、**e2e 测试** |
| 可以粘贴建表语句 | **不支持**，建表只能写迁移 |

### 监控

| RuoYi | 本项目 |
| --- | --- |
| Druid 数据监控 | MySQL 状态卡片 |
| 服务监控（JVM 面板） | 服务监控（Node 运行时面板） |
| 缓存监控、缓存列表 | 缓存监控、缓存列表 |
| 在线用户、强退 | 在线用户、强退、**批量强退**，被踢的用户**立即掉线** |

### 工作流

RuoYi 本身没有审批流程，芋道等框架用 Flowable 这类 BPMN 引擎直接运行流程图。这个项目不一样：

| 基于 Flowable / Camunda 的系统 | 本项目 |
| --- | --- |
| BPMN 引擎直接执行流程图 | 自研的树形引擎。BPMN 设计器只是另一种画法，发布时服务端把流程图转换成和树形设计器一样的流程树，由同一个引擎运行 |
| 条件写成表达式（`${...}`），可以挂执行监听器、任务监听器 | 条件只能用条件构造器设置；表达式、监听器、脚本任务和这些工具自己的扩展配置，发布时直接拒绝 |
| 子流程、边界事件、泳池等 BPMN 元素 | 只支持一个子集：开始、结束、审批、抄送、排他/并行/包容网关和连线；不能有回环，返工用退回或驳回 |

新建模型时选流程类型"树形"（仿钉钉）或"BPMN"，创建后不能更改；新建审批向导和内置模板只用树形。

::: warning 原来的 .bpmn 文件不能直接用
从基于 Flowable 或 Camunda 的系统导出的 `.bpmn` 文件，通常带有表达式、监听器或这些工具的扩展配置，导入后无法发布（出错的元素会在画布上标红）。这类流程要在 BPMN 设计器里重新画。
:::

详见[工作流](/features/workflow)。

## 你会发现多出来的东西

- **国际化**：界面、错误信息、菜单、字典、消息模板、Excel 表头都支持中英文切换；
- **前后端共享校验规则**：同一个 zod 规则同时用于后端和前端表单；
- **每个模块都有 e2e 测试**，并且有一套自动检查：`pnpm verify`；
- **消息中心**：站内信、邮件、短信统一调用 `notifier.send()`，事务提交后才发送，不会丢失；
- **实时推送**：WebSocket，强退、新消息、审批待办都能即时送达；
- **审批流程**：内置的树形流程引擎，可以用仿钉钉的树形设计器或 BPMN 设计器画流程（区别见上面的[工作流](#工作流)），节点到期后可以自动通过、自动驳回或转给上级；还有零代码审批：用"新建审批"向导拖出表单、画出流程就能发布，内置通用审批、请假、报销、加班模板，申请数据可以按表单字段查询和导出；
- **表单构建**：RuoYi 的"系统工具 → 表单构建"在这里也有同名菜单，用来拖拽设计、预览表单，并导出 JSON 和 Vue 代码，但这里不保存表单。审批用的表单在"流程管理 → 表单管理"或"新建审批"向导里保存，保存时会经过安全白名单检查，不能带函数和事件代码，之后可以绑定到审批流程，见[表单设计器](/features/formkit)。

## 迁移已有的 RuoYi 项目

**没有自动迁移工具**，也不推荐直接迁移：表结构、接口协议、权限写法都不一样。

比较现实的做法是：用这个模板开一个新项目，把业务表用迁移重新定义（按[新增业务模块](/guide/new-module)中的约定），再用代码生成器生成代码，然后把原来的业务逻辑逐个移植到服务里。用户、角色、菜单这些基础数据，写一次性的导入脚本转换过来。
