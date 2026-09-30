# 第一次把项目跑起来

这一页一共 7 步。每一步都写了"你应该看到"的内容，**对上了再做下一步**。

::: tip Windows 用户
- 直接在 Windows 上开发：所有命令都在 **Git Bash** 里执行；第 3 步的 SQL 在 **MySQL Workbench** 里执行；
- 使用 WSL2：所有命令都在 **Ubuntu 窗口**里执行；凡是写 `mysql -u root` 的地方，换成 `sudo mysql`。
:::

## 第 1 步：下载代码

```bash
mkdir -p ~/work
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

```bash [Mac]
mysql -u root <<'SQL'
CREATE DATABASE qiwu_dev CHARACTER SET utf8mb4;
CREATE USER 'qiwu'@'localhost' IDENTIFIED BY 'qiwu123456';
CREATE USER 'qiwu'@'127.0.0.1' IDENTIFIED BY 'qiwu123456';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'localhost';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'127.0.0.1';
SQL
```

```bash [WSL2]
sudo mysql <<'SQL'
CREATE DATABASE qiwu_dev CHARACTER SET utf8mb4;
CREATE USER 'qiwu'@'localhost' IDENTIFIED BY 'qiwu123456';
CREATE USER 'qiwu'@'127.0.0.1' IDENTIFIED BY 'qiwu123456';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'localhost';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'127.0.0.1';
SQL
```

```sql [Windows（MySQL Workbench）]
-- 用 root 连接本地数据库，把下面的 SQL 粘贴到查询窗口，点闪电图标执行
CREATE DATABASE qiwu_dev CHARACTER SET utf8mb4;
CREATE USER 'qiwu'@'localhost' IDENTIFIED BY 'qiwu123456';
CREATE USER 'qiwu'@'127.0.0.1' IDENTIFIED BY 'qiwu123456';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'localhost';
GRANT ALL ON qiwu_dev.* TO 'qiwu'@'127.0.0.1';
```

:::

点击代码块上方的标签，选择你的系统，把那一段复制下来执行。

这几行 SQL 的意思是：

1. 创建一个名叫 `qiwu_dev` 的数据库，使用 `utf8mb4` 编码（这样才能正确保存中文和表情符号）；
2. 创建用户 `qiwu`，密码是 `qiwu123456`（写两遍，是因为连接数据库时，地址可能是 `localhost`，也可能是 `127.0.0.1`）；
3. 允许 `qiwu` 用户操作 `qiwu_dev` 数据库里的所有内容。

成功的话，**不会有任何输出**。检查一下（Mac、WSL2）：

```bash
mysql -u qiwu -pqiwu123456 -h 127.0.0.1 -e "SHOW DATABASES;"
```

你应该看到列表里有 `qiwu_dev`。使用 MySQL Workbench 的话，在左侧的 Schemas 面板点刷新，应该能看到 `qiwu_dev`。

::: warning 报错 `database exists` 或者 `Operation CREATE USER failed`
说明之前已经创建过了，可以忽略，直接做下一步。
:::

## 第 4 步：配置环境变量

后端需要知道：数据库在哪里、用户名和密码是什么。这些信息写在**环境变量文件**里。

```bash
cd apps/server
cp .env.example .env
```

`cp` 是复制文件：把模板 `.env.example` 复制一份，命名为 `.env`。

然后创建存放密码的文件 `.env.local`。复制下面整段执行（第一行会自动生成一个随机密钥）：

```bash
SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
cat > .env.local <<EOF
DB_USER=qiwu
DB_PASSWORD=qiwu123456
REDIS_USERNAME=
REDIS_PASSWORD=
APP_SECRET=$SECRET
EOF
cat .env.local
```

你应该看到：

```text
DB_USER=qiwu
DB_PASSWORD=qiwu123456
REDIS_USERNAME=
REDIS_PASSWORD=
APP_SECRET=（一串 43 个字符的随机字母和数字）
```

::: danger 这两个文件不能上传
`.env` 和 `.env.local` 里有密码，项目已经设置好不会把它们提交到 Git。**不要把它们发给别人，也不要截图发到网上。**
:::

回到项目根目录：

```bash
cd ../..
pwd
```

`pwd` 的输出应该以 `/qiwu-vue-admin` 结尾。

## 第 5 步：初始化数据库

现在数据库还是空的。下面两条命令会先编译共享代码，然后**创建所有的表，并写入初始数据**（菜单、角色、管理员账号……）：

```bash
pnpm --filter @qiwu/shared build
pnpm db:reset
```

第二条命令会输出很多内容，最后几行应该是：

```text
seed: admin password (shown once, must be changed at first sign-in): Xy3kP9…
db:reset: qiwu_dev dropped, migrated and seeded
```

::: danger 把密码记下来！
`seed: admin password …` 冒号后面的那一串，就是管理员 `admin` 的初始密码，**只显示这一次**。把它复制到记事本里。

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

然后打开 `http://localhost:5173`。（使用 WSL2 的话，记得先启动 MySQL 和 Redis，见[安装环境（Windows）](/beginner/install-windows#方式二-使用-wsl2)。）

## 出问题了？

| 现象 | 原因和解决办法 |
| --- | --- |
| 启动时报错，提到 `APP_SECRET` | 第 4 步的 `.env.local` 没有创建成功。执行 `cat apps/server/.env.local` 看看内容对不对 |
| 报错 `Access denied for user 'qiwu'` | 数据库的用户名或密码不对。检查第 3 步和第 4 步的密码是否一致 |
| 报错 `ECONNREFUSED 127.0.0.1:3306` | MySQL 没有启动。Mac：`brew services start mysql`；Windows：在"服务"里启动 MySQL 服务；WSL2：`sudo service mysql start` |
| 报错 `ECONNREFUSED 127.0.0.1:6379` | Redis 没有启动。Mac：`brew services start redis`；Windows：在"服务"里启动 Memurai；WSL2：`sudo service redis-server start` |
| 报错 `EADDRINUSE` 并且提到 `3000` | 3000 端口被占用了，通常是之前启动的项目没有关掉。找到那个终端按 `Ctrl + C`，或者重启电脑 |
| 浏览器打开是空白页，或者显示"无法访问" | `pnpm dev` 没有在运行，或者还没启动完成。看看终端里有没有报错 |
| 登录时提示"用户名或密码错误" | 复制密码时多了或者少了字符。重新执行 `pnpm db:reset` 生成新密码 |

还是解决不了？看[看不懂报错怎么办](/beginner/errors)。

下一步：[逛一逛后台](/beginner/admin-tour)。
