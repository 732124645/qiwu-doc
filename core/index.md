# 开发指南总览

这一栏是**写代码时的参考手册**：每一页讲清楚一层的全部用法，并且都使用项目里的真实代码举例。想先了解模板能做什么、各个页面怎么用，请看[功能](/features/)。

如果你是第一次接触这个项目，建议先看入门路线（[学生和新手](/beginner/)、[前端开发者](/backend/)、[Java 开发者](/java/)），做一遍[新增业务模块](/guide/new-module)，再回来查阅这里。

## 后端核心

写任何一个后端功能，都会用到这几层：

```text
请求 ──▶ 控制器 ──▶ 服务 ──▶ 实体 / 查询 ──▶ 数据库
          │          │
       参数校验     异常处理
```

| 页面 | 讲什么 |
| --- | --- |
| [模块结构与注册](/core/module) | 一个模块有哪些文件、放在哪里、怎么注册、模块之间怎么互相调用 |
| [控制器](/core/controller) | 路由、各种参数的取法、标准的增删改查接口、自定义操作、上传下载、返回格式、装饰器一览 |
| [服务](/core/service) | `BaseCrudService` 的全部方法、如何覆写、事务、调用其他服务 |
| [实体与数据库](/core/entity) | 实体和列的写法、关联、引用检查、迁移 |
| [查询](/core/query) | QueryBuilder、分页、排序、筛选、联表、原生 SQL |
| [参数校验](/core/validation) | zod 规则的写法、常用校验、错误提示的翻译 |
| [异常处理](/core/errors) | 抛出错误、定义错误码、错误响应的格式 |
| [种子与菜单](/core/seed) | 初始数据、菜单和按钮权限、种子的执行规则 |

## 后端功能

项目已经做好、可以直接使用的能力：

| 我想要…… | 用什么 | 页面 |
| --- | --- | --- |
| 控制谁能做什么、能看到哪些数据 | `@RequirePerm`、`@DataScoped` | [权限与数据范围](/core/permission) |
| 把频繁读取的数据暂存起来 | Redis | [缓存](/core/cache) |
| 防止重复提交、限制调用频率、互斥执行 | `@Idempotent`、`@RateLimit`、`RedisLock` | [防重复提交、限流与锁](/core/guards) |
| 定时执行一段逻辑 | `@JobHandler` | [定时任务](/core/job) |
| 发站内信、邮件、短信 | `Notifier` | [消息通知](/core/notify) |
| 实时推送给浏览器 | `RealtimeService` | [实时推送](/core/realtime) |
| 上传图片或附件 | `ImageUpload` / `FileUpload` | [文件上传](/core/upload) |
| 导出或导入 Excel | `ExcelService` | [Excel 导入导出](/core/excel) |
| 可以设置格式的正文 | `RichEditor` + 服务端清洗 | [富文本](/core/richtext) |
| 下拉框选项由管理员维护 | 字典 | [字典](/core/dict) |
| 配置值可以在后台修改 | 参数 | [参数设置](/core/param) |
| 记录谁做了什么 | `@ActionLog` | [操作日志](/core/action-log) |
| 多语言 | 翻译键 | [国际化](/core/i18n) |

## 前端核心

| 页面 | 讲什么 |
| --- | --- |
| [接口请求](/core/web-request) | 调用后端接口、错误处理、下载文件 |
| [路由与菜单](/core/web-router) | 页面怎么根据菜单注册、隐藏页面、页面缓存 |
| [列表页](/core/crud-list) | `useCrudList`、`QwTable`、查询和分页 |
| [表单弹框](/core/crud-form) | `useCrudForm`、`openDialog` |
| [权限与翻译](/core/web-perm-i18n) | `v-perm`、`usePerm`、`t()`、`tx()` |
| [常用组件](/core/web-components) | 项目自带的全部组件和组合式函数 |
