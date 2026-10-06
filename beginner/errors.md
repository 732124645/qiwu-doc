---
description: '教新手读懂报错：从调用栈里找出关键的一行、常见英文词的含义，安装启动和写代码时的常见报错与 HTTP 状态码速查，以及怎样提问更容易得到帮助。'
---

# 看不懂报错怎么办

报错看起来吓人，其实它是在**告诉你哪里出了问题**。学会读报错，是从新手成长起来最重要的一步。

## 读报错的方法

### 1. 找到真正的错误信息

终端里的报错常常有几十行，**大部分是"调用栈"**，也就是程序出错时一层层的调用记录。真正有用的信息，通常在**最前面的一两行**或者**最后面的一两行**。

```text
Error: connect ECONNREFUSED 127.0.0.1:3306          ← 就是这一行！
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1611:16)
    at …（后面几十行都是调用栈，先不用看）
```

找带有 `Error`、`error`、`ERR_`、`failed`、`refused`、`denied`、`not found` 这些词的行。

### 2. 翻译成中文

`ECONNREFUSED 127.0.0.1:3306` 意思是"连接 127.0.0.1 的 3306 端口被拒绝"。3306 是 MySQL 的端口，所以问题是：**MySQL 没有在运行**。

不认识的英文单词，直接查翻译。常见的词：

| 英文 | 意思 |
| --- | --- |
| not found / cannot find | 找不到 |
| refused | 被拒绝（通常是服务没有启动） |
| denied | 被禁止（通常是密码错误或者没有权限） |
| already in use / already exists | 已经被占用 / 已经存在 |
| undefined / null | 没有值 |
| unexpected token | 语法错误（通常是少了括号、引号、逗号） |
| timeout | 超时（通常是网络问题） |
| permission | 权限 |
| invalid | 无效的 |
| missing | 缺少 |

### 3. 想想刚才做了什么

报错通常和**你刚刚做的修改**有关。刚改了哪个文件？刚执行了哪条命令？先从那里查起。

### 4. 搜索

把**错误信息的关键部分**复制出来去搜索，不要带上你电脑上的路径和用户名。比如：

- ✅ 搜索 `ECONNREFUSED 127.0.0.1:3306`
- ❌ 搜索 `/Users/xiaoming/work/qiwu-vue-admin/apps/server/dist/main.js:23`

也可以把完整的报错信息发给 AI 助手，让它帮你解释。

## 常见报错速查

### 安装和启动

| 报错 | 原因 | 解决办法 |
| --- | --- | --- |
| `command not found: pnpm`（或者 node、git） | 软件没装，或者装完没有重新打开终端 | 重新打开终端；还不行就重新安装 |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL 没有运行 | 启动 MySQL（参见安装环境那一页） |
| `ECONNREFUSED 127.0.0.1:6379` | Redis 没有运行 | 启动 Redis |
| `Access denied for user 'qiwu'` | 数据库密码不对 | 检查 `apps/server/.env.local` 里的 `DB_PASSWORD` |
| `Unknown database 'qiwu_dev'` | 数据库还没有创建 | 做[第一次把项目跑起来](/beginner/first-run)的第 3 步 |
| `EADDRINUSE` | 端口被占用了，通常是项目已经在另一个终端里运行 | 找到那个终端按 `Ctrl + C` |
| 启动时提示某个环境变量无效 | `.env` 或 `.env.local` 里少了或者写错了 | 对照[环境变量](/reference/env)检查 |
| `ERR_PNPM_…` 并且提到网络或 `ETIMEDOUT` | 网络问题 | 设置国内镜像：`pnpm config set registry https://registry.npmmirror.com` |

### 写代码时

| 报错 | 原因 | 解决办法 |
| --- | --- | --- |
| `Cannot find module './xxx'` | 导入的文件路径写错了，或者**少写了 `.js` 后缀** | 后端代码里导入相对路径，要写成 `'./xxx.js'` |
| `Unexpected token` | 语法错误：少了括号、引号或逗号 | 看报错里的行号，检查那一行和上一行 |
| `xxx is not defined` | 用了一个没有定义的变量，或者忘了 import | 检查拼写，检查有没有导入 |
| `Cannot read properties of undefined (reading 'xxx')` | 对一个空值取了属性 | 找到是哪个变量为空，想想它为什么没有值 |
| `Nest can't resolve dependencies of …` | 后端的服务没有注册到模块里 | 检查模块文件的 `providers` 和 `imports` |
| `the xxx menu group is missing` | 模块的父菜单分组不存在 | 把分组加到 `apps/server/src/db/seeds/project/menu-groups.seed.ts`（代码生成器的注册代码里有这一段），或者在代码生成的"生成信息"里换一个父菜单后重新生成 |

### 页面上的错误

在浏览器里按 `F12`（Mac：`⌘ + Option + I`）打开**开发者工具**：

- **Console（控制台）** 页签：前端代码的报错，红色的就是；
- **Network（网络）** 页签：每个请求的记录。点一个标红的请求，看它的**状态码**和**返回内容**。

| 状态码 | 意思 | 该查哪里 |
| --- | --- | --- |
| 400 | 提交的数据不符合规则 | 返回内容里的 `errors` 会写明是哪个字段 |
| 401 | 登录已经过期 | 重新登录 |
| 403 | 没有权限 | 检查角色有没有勾选这个权限 |
| 404 | 找不到 | 接口地址写错了、模块没有注册，或者这条数据不在你的权限范围内 |
| 409 | 数据冲突 | 比如编码重复了，或者这条数据正在被别处使用，不能删除 |
| 500 | 服务器内部出错 | **去看运行 `pnpm dev` 的那个终端**，那里有详细的报错 |

## 怎么向别人提问

好的提问能让别人快速帮到你。请包含这几样东西：

1. **我想做什么**：比如"我在做课程管理，第 ⑥ 步执行 `pnpm db:seed`"；
2. **我做了什么**：执行了哪些命令，改了哪些文件；
3. **完整的报错**：复制文字，**不要只发截图**（截图没法搜索，也没法复制）；
4. **我已经试过什么**：比如"我检查了 MySQL 是在运行的"。

::: danger 不要发出去的东西
`.env.local` 里的内容、密码、`APP_SECRET`。提问时如果需要展示配置，把这些值换成 `***`。
:::
