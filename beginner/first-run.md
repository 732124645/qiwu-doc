# 第一次把项目跑起来

这一页一共 7 步。每一步都写了"你应该看到"的内容，**对上了再做下一步**。

::: tip Windows 用户
命令在 **Windows 终端或 VS Code 终端里的 Windows PowerShell 5.1** 中执行，有代码组时选 Windows 一栏；第 3 步的 SQL 在 **MySQL Workbench** 里执行。先按[安装环境（Windows）](/beginner/install-windows)完成“允许运行脚本”，再使用 pnpm。
:::

## 第 1 步：下载代码

::: code-group

```bash [macOS]
mkdir -p ~/work
```

```powershell [Windows（PowerShell）]
New-Item -ItemType Directory -Force ~/work
```

:::

然后执行（两种系统相同）：

```bash
cd ~/work
git clone <项目地址> qiwu-vue-admin
cd qiwu-vue-admin
```

`<项目地址>` 请换成项目主页上的仓库地址（或者老师给你的地址）。

你应该看到：

```text
Cloning into 'qiwu-vue-admin'...
…
Resolving deltas: 100% …, done.
```

执行 `ls`，应该能看到 `apps`、`packages`、`package.json` 等文件和文件夹。

## 第 2 步：安装依赖

项目用到了很多别人写好的代码包（比如 Vue、NestJS），它们没有放在仓库里，需要下载下来：

```bash
pnpm i
```

第一次安装要下载几百 MB 的内容，可能需要几分钟。你应该看到最后是：

```text
Done in 1m 23s
```

::: warning 下载很慢或者超时
这是网络问题。可以设置国内的 npm 镜像后再试：

```bash
pnpm config set registry https://registry.npmmirror.com
pnpm i
```
:::

装好之后，项目里会多出一个 `node_modules` 文件夹，里面就是下载下来的代码包。**不要修改它，也不要把它提交到 Git。**

## 第 3 步：创建数据库

我们要创建一个专门给这个项目用的数据库 `qiwu_dev`，以及一个数据库用户 `qiwu`。下面的 `qiwu123456` 是这个数据库用户的密码，你可以换成别的，但**第 4 步要填同一个**。

::: code-group

```bash [macOS]
mysql -u root <<'SQL'
CREATE DATABASE IF NOT EXISTS qiwu_dev CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'qiwu'@'localhost' IDENTIFIED BY 'qiwu123456';
CREATE USER IF NOT EXISTS 'qiwu'@'127.0.0.1' IDENTIFIED BY 'qiwu123456';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'localhost';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'127.0.0.1';
SQL
```

```sql [Windows（MySQL Workbench）]
-- 用 root 连接本地数据库，把下面的 SQL 粘贴到查询窗口，点闪电图标执行
CREATE DATABASE IF NOT EXISTS qiwu_dev CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'qiwu'@'localhost' IDENTIFIED BY 'qiwu123456';
CREATE USER IF NOT EXISTS 'qiwu'@'127.0.0.1' IDENTIFIED BY 'qiwu123456';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'localhost';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'127.0.0.1';
```

:::

点击代码块上方的标签，选择你的系统，把那一段复制下来执行。

这几行 SQL 的意思是：

1. 创建一个名叫 `qiwu_dev` 的数据库，使用 `utf8mb4` 编码（这样才能正确保存中文和表情符号）；
2. 创建用户 `qiwu`，密码是 `qiwu123456`（写两遍，是因为连接数据库时，地址可能是 `localhost`，也可能是 `127.0.0.1`）；
3. 允许 `qiwu` 用户操作 `qiwu_dev` 数据库里的所有内容。

Mac 命令成功时不会有输出；MySQL Workbench 会在执行结果里显示成功。再检查一下：

::: code-group

```bash [macOS]
mysql -u qiwu -p -h 127.0.0.1 -e "SHOW DATABASES;"
```

```sql [Windows（MySQL Workbench）]
-- 回到 Workbench 首页，点 MySQL Connections 旁边的 ⊕ 新建连接：
-- Connection Name 填 qiwu，Hostname 127.0.0.1，Port 3306，Username qiwu；
-- 点 Test Connection，输入 qiwu123456，看到连接成功后点 OK 保存；
-- 再点首页上新出现的 qiwu 连接，在它的查询窗口执行：
SHOW DATABASES;
```

:::

Mac 提示输入密码时，填刚才的 `qiwu123456`（输入时不显示字符）。Windows 一定要在新建的 `qiwu` 连接里执行，不要用第 3 步 root 的查询窗口：root 能看到所有数据库，在那里查不出 `qiwu` 的密码和权限有没有问题。你应该看到列表里有 `qiwu_dev`。如果 Test Connection 提示 `Access denied`，说明 `qiwu` 用户没建好，或者密码和第 3 步不一致，需要先解决再做第 4 步。

::: tip 可以重复执行
这几行 SQL 可以重复执行：已经存在的数据库和用户会被跳过（Workbench 会显示黄色警告，可以忽略），授权也会重新执行一遍。

注意：已经存在的用户不会改密码。如果 `qiwu` 用户以前用别的密码建过，第 4 步要填旧密码；或者用 root 执行 `ALTER USER 'qiwu'@'localhost' IDENTIFIED BY 'qiwu123456';` 和 `ALTER USER 'qiwu'@'127.0.0.1' IDENTIFIED BY 'qiwu123456';` 把密码改成新的。
:::

## 第 4 步：配置环境变量

后端需要知道：数据库在哪里、用户名和密码是什么。这些信息写在**环境变量文件**里。

```bash
cd apps/server
```

::: code-group

```bash [macOS]
cp .env.example .env
```

```powershell [Windows（PowerShell）]
Copy-Item .env.example .env
```

:::

`cp`（Mac）和 `Copy-Item`（PowerShell）都是复制文件：把模板 `.env.example` 复制一份，命名为 `.env`。执行 `ls` 查看目录；PowerShell 会列出 `.env`，Mac 要用 `ls -a` 才会显示这种以点开头的文件。

然后创建存放密码的文件 `.env.local`。先生成随机密钥 `APP_SECRET`，服务端用它加密保存的第三方密码（两种系统相同）：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

你应该看到一串 43 个字符的随机字母、数字、`-` 或 `_`。复制这串密钥，接下来要填进文件。

用编辑器新建文件：

::: code-group

```bash [macOS]
code .env.local
```

```powershell [Windows（PowerShell）]
notepad .env.local
```

:::

Mac 在 VS Code 中新建这个文件；Windows 如果提示文件不存在，选择新建。粘贴下面的内容，把最后一行的占位文字换成刚才生成的密钥，再保存：

```ini
DB_USER=qiwu
DB_PASSWORD=qiwu123456
REDIS_USERNAME=
REDIS_PASSWORD=
APP_SECRET=粘贴刚才生成的密钥
```

保存为 **UTF-8（不带 BOM）**，文件名必须是 `.env.local`，不能多出 `.txt`；记事本另存为时可把文件类型选为“所有文件”。也可以直接用 VS Code 新建并保存。**不要用 Windows PowerShell 5.1 的 `>`、`Out-File` 或 `Set-Content` 写配置文件**：`>` 和 `Out-File` 默认写成 UTF-16，整个文件都读不出来；`Set-Content` 默认用系统本地编码（中文 Windows 是 GBK），值里有中文等非 ASCII 字符就会乱码；加 `-Encoding UTF8` 又会带 BOM，第一行的变量可能读不出来。

检查（两种系统相同）：

```bash
cat .env.local
```

你应该看到上面的五行，`APP_SECRET` 已经换成随机密钥。

::: tip 为什么分成两个文件
`.env` 放普通配置（端口、数据库名……），`.env.local` 放密码。**密码只能写在 `.env.local` 里**：服务端先读 `.env`，两个文件里都有的变量以 `.env` 为准，所以 `.env` 里哪怕有一行空的 `DB_PASSWORD=`，`.env.local` 里的密码也不会生效。
:::

::: danger 这两个文件不能上传
`.env` 和 `.env.local` 里有密码，项目已经设置好不会把它们提交到 Git。**不要把它们发给别人，也不要截图发到网上。**
:::

回到项目根目录：

```bash
cd ../..
pwd
```

`pwd` 显示的路径应该以 `/qiwu-vue-admin`（Mac）或 `\qiwu-vue-admin`（Windows）结尾；PowerShell 看 `Path` 一栏。

## 第 5 步：初始化数据库

现在数据库还是空的。下面两条命令会先编译共享代码，然后**创建所有的表，并写入初始数据**（菜单、角色、管理员账号……）：

```bash
pnpm --filter @qiwu/shared build
pnpm db:reset
```

第二条命令会输出很多内容，最后几行应该是：

```text
seed: admin password (shown once, must be changed at first sign-in): Xy3kP9…
seed: initial password of new users (iam.user.initial_password): …
seed: password of OA demo users oa.employee, oa.supervisor, oa.deputy, oa.director, oa.hr (shown once, must be changed at first sign-in): …
db:reset: qiwu_dev dropped, migrated and seeded
```

::: danger 把密码记下来！
`seed: admin password …` 这一行冒号后面的那一串，就是管理员 `admin` 的初始密码，**只显示这一次**。把它复制到记事本里。下面两行是新用户的初始密码和 OA 示例用户的密码，不要和管理员密码弄混。

忘了也没关系：重新执行一次 `pnpm db:reset`，会生成一个新密码。不过这样会清空数据库里的所有数据。
:::

## 第 6 步：启动

```bash
pnpm dev
```

这条命令会同时启动三个程序：共享代码的编译、后端服务器（3000 端口）、前端开发服务器（5173 端口）。它会**一直运行，不会自己结束**，这是正常的。

等十几秒，看到类似这样的一行，就说明启动成功了：

```text
  ➜  Local:   http://localhost:5173/
```

::: tip 保持这个终端开着
只要这个终端开着，网站就能访问。想停止时，在这个终端里按 `Ctrl + C`。需要执行其他命令时，**新开一个终端窗口**（VS Code 里点终端面板右上角的 `+`）。
:::

## 第 7 步：登录

1. 打开浏览器，访问 `http://localhost:5173`；
2. 你会看到登录页。用户名填 `admin`，密码填第 5 步记下来的初始密码；
3. 点击登录后，会弹出一个**滑块验证码**：把拼图块拖到缺口的位置；
4. 因为是第一次登录，系统会**要求你修改密码**。新密码至少 8 位，并且要包含小写字母、大写字母、数字、符号这四类中的至少两类，比如 `Qiwu@2026`；
5. 改完密码后，就进入后台首页了。🎉

**恭喜，项目跑起来了！**

## 以后每次怎么启动

第 1 ~ 5 步只需要做一次。以后每次想运行项目：

```bash
cd ~/work/qiwu-vue-admin
pnpm dev
```

然后打开 `http://localhost:5173`。Windows 上如果数据库或缓存没有运行，按[安装环境（Windows）](/beginner/install-windows#_7-redis-安装-memurai)里的说明，在“服务”（`services.msc`）里启动它们。

## 出问题了？

| 现象 | 原因和解决办法 |
| --- | --- |
| 启动时报错，提到 `APP_SECRET` | 第 4 步的 `.env.local` 没有创建成功，执行 `cat apps/server/.env.local` 看看内容对不对。再检查 `apps/server/.env` 里有没有 `APP_SECRET` 这一行（哪怕是空的 `APP_SECRET=`），有就删掉，原因见第 4 步的说明 |
| 报错 `Access denied for user 'qiwu'` | 数据库的用户名或密码不对。检查第 3 步和第 4 步的密码是否一致 |
| 报错 `ECONNREFUSED 127.0.0.1:3306` | MySQL 没有启动。Mac：`brew services start mysql`；Windows：在"服务"里启动 MySQL 服务 |
| 报错 `ECONNREFUSED 127.0.0.1:6379` | Redis 没有启动。Mac：`brew services start redis`；Windows：在"服务"里启动 Memurai |
| 报错 `EADDRINUSE` 并且提到 `3000` | 3000 端口被占用了，通常是之前启动的项目没有关掉。找到那个终端按 `Ctrl + C`，或者重启电脑 |
| 浏览器打开是空白页，或者显示"无法访问" | `pnpm dev` 没有在运行，或者还没启动完成。看看终端里有没有报错 |
| 登录时提示"用户名或密码错误" | 复制密码时多了或者少了字符。重新执行 `pnpm db:reset` 生成新密码 |

还是解决不了？看[看不懂报错怎么办](/beginner/errors)。

下一步：[逛一逛后台](/beginner/admin-tour)。
