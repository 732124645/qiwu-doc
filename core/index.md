# 核心模块一览

写业务时，很多需求项目里已经有现成的能力，**直接拿来用就行，不需要自己从头写**。这一栏每个主题单独一页，都配有项目里的真实代码。

## 我想要……

| 需求 | 用什么 | 页面 |
| --- | --- | --- |
| 下拉框的选项可以由管理员维护（比如"客户等级"） | 字典 | [字典](/core/dict) |
| 一个配置值可以在后台修改，不用改代码重新部署 | 参数 | [参数设置](/core/param) |
| 记录谁在什么时候做了什么操作 | `@ActionLog` | [操作日志](/core/action-log) |
| 把频繁读取的数据暂存起来 | Redis 缓存 | [缓存](/core/cache) |
| 防止用户连点提交两次 | `@Idempotent` | [防重复提交、限流与锁](/core/guards) |
| 限制某个接口的调用频率（比如发短信） | `@RateLimit` | [防重复提交、限流与锁](/core/guards) |
| 每天凌晨执行一次清理任务 | `@JobHandler` | [定时任务](/core/job) |
| 给用户发站内信、邮件或短信 | `Notifier` | [消息通知](/core/notify) |
| 上传图片或附件 | `ImageUpload` / `FileUpload` | [文件上传](/core/upload) |
| 导出 Excel，或者从 Excel 批量导入 | `ExcelService` | [Excel 导入导出](/core/excel) |
| 可以编辑格式的正文 | `RichEditor` + 服务端清洗 | [富文本](/core/richtext) |
| 做一个标准的列表页 | `useCrudList` + `QwTable` | [列表页](/core/crud-list) |
| 做一个新增和编辑的表单 | `useCrudForm` + `openDialog` | [表单弹框](/core/crud-form) |
| 按权限显示按钮、显示多语言文字 | `v-perm`、`t()`、`tx()` | [权限与翻译](/core/web-perm-i18n) |

还有一些能力已经在别的栏目里讲过了：

- 权限点和数据范围：[权限与数据范围](/features/permission)
- 事务和锁：[数据库基础](/backend/database#事务-要么全成功-要么全失败)
- 实时推送：[实时推送](/features/realtime)
- 当前登录用户：[登录是怎么回事](/backend/auth#在代码里获取当前用户)
