# 安装开发环境（Windows）

在 Windows 上有两种方式，**任选一种**：

| | 方式一：直接在 Windows 上开发 | 方式二：使用 WSL2 |
| --- | --- | --- |
| 是什么 | 软件都装在 Windows 里 | 在 Windows 里运行一个 Linux（Ubuntu），软件装在 Linux 里 |
| 优点 | 最直观，不用额外学 Linux | 命令和 Mac、Linux 服务器完全一样，教程可以照着敲 |
| 需要注意 | Redis 没有官方的 Windows 版，要装兼容的替代品；教程里的命令要在 **Git Bash** 里执行 | 要多装一层；项目代码要放在 Linux 的目录里 |

拿不定主意的话，**选方式一**就可以。

---

## 方式一：直接在 Windows 上开发

| 软件 | 干什么用 |
| --- | --- |
| Git for Windows | 版本管理，同时自带 **Git Bash** 终端 |
| Node.js 22 | 运行 JavaScript / TypeScript 程序 |
| pnpm | 下载和管理项目依赖 |
| MySQL | 数据库 |
| Memurai（Redis 兼容） | 缓存 |
| VS Code | 写代码的编辑器 |

### 1. Git for Windows 和 Git Bash

1. 打开 git-scm.com，下载 Windows 版并安装。安装选项全部保持默认即可；
2. 装好后，在开始菜单里打开 **Git Bash**。

**本教程里的所有命令，都在 Git Bash 里执行。** 教程里的命令是 Mac 和 Linux 的写法（比如 `cp`、`cat`、`$(...)`），Windows 自带的 CMD 和 PowerShell 不能直接执行，Git Bash 可以。

检查：

```bash
git --version
```

你应该看到 `git version 2.x.x.windows.x`。

设置你的名字和邮箱：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

### 2. Node.js 22

1. 打开 nodejs.org，在下载页面选择 **v22 版本**（LTS）的 Windows 安装包（`.msi`），安装时保持默认选项；
2. 安装完成后，**关闭 Git Bash，再重新打开**。

检查：

```bash
node --version
npm --version
```

你应该看到 `v22.xx.x`（第一个数字必须是 22，并且不低于 `v22.22.1`），以及 npm 的版本号。

::: tip 需要同时使用多个 Node 版本？
可以使用 **nvm-windows**（在 GitHub 上搜索 nvm-windows）来安装和切换 Node 版本：`nvm install 22`、`nvm use 22`。
:::

### 3. pnpm

```bash
npm install -g pnpm@11
pnpm --version
```

你应该看到 `11.x.x`。

### 4. MySQL

1. 打开 dev.mysql.com/downloads，下载 **MySQL Installer for Windows**（或者 MySQL Community Server 的 `.msi` 安装包），安装 **MySQL Server 8.0 或以上版本**；
2. 安装过程中会让你设置 **root 用户的密码**，**请记下来**；
3. 保持"作为 Windows 服务运行"和"开机自动启动"的默认选项；
4. 同时勾选安装 **MySQL Workbench**，它是一个图形界面工具，后面建数据库时会用到。

检查：在开始菜单里打开 **MySQL Workbench**，点击本地的连接（`Local instance`），输入 root 密码，能连上就说明 MySQL 正常运行。

::: tip 在 Git Bash 里使用 mysql 命令（可选）
MySQL 安装程序默认不会把 `mysql` 命令加到环境变量里。想在终端里使用的话，要把 MySQL 的 `bin` 目录（比如 `C:\Program Files\MySQL\MySQL Server 8.4\bin`）添加到系统环境变量 `Path` 中，然后重新打开 Git Bash。用 MySQL Workbench 的话，可以跳过这一步。
:::

### 5. Redis：安装 Memurai

Redis 官方没有 Windows 版本。**Memurai** 是一个兼容 Redis 的 Windows 原生软件，开发者版可以免费使用：

1. 打开 memurai.com，下载 **Memurai Developer** 并安装；
2. 安装后它会作为 Windows 服务自动运行，端口是 6379，和 Redis 一样。

::: warning 需要 Redis 6.2 或以上的兼容版本
项目用到了 Redis 6.2 才有的命令（比如 `GETDEL`）。网上一些很旧的"Redis for Windows"（3.x、5.x 版本）**不能用**，登录时的验证码会出错。
:::

检查（在 Git Bash 里）：

```bash
memurai-cli ping
```

你应该看到 `PONG`。如果提示找不到命令，打开 Memurai 的安装目录，双击运行 `memurai-cli.exe`，再输入 `ping`。

::: details 其他选择
- 已经装了 **Docker Desktop** 的话，可以用 `docker run -d -p 6379:6379 --name redis redis:7` 启动一个 Redis；
- 也可以只在 WSL2 里装 Redis（参见下面的方式二），项目本身仍然在 Windows 上运行。
:::

### 6. VS Code

1. 打开 code.visualstudio.com，下载 Windows 版并安装。安装时勾选"**添加到 PATH**"；
2. 打开 VS Code，在左侧"扩展"中安装：**Vue - Official**、**ESLint**、**Prettier - Code formatter**，以及可选的 **Chinese (Simplified) Language Pack**；
3. 把 VS Code 的默认终端设置成 Git Bash：按 `Ctrl + Shift + P`，输入 `Terminal: Select Default Profile`，选择 **Git Bash**。

### 最后检查一遍

在 Git Bash 里执行：

```bash
git --version; node --version; pnpm --version
```

- [ ] `git version 2.x`
- [ ] `v22.x.x`
- [ ] `11.x.x`
- [ ] MySQL Workbench 能连上本地数据库
- [ ] Memurai 返回 `PONG`

### 方式一在后面教程中的区别

- 所有命令都在 **Git Bash** 里执行；
- [第一次把项目跑起来](/beginner/first-run)的第 3 步"创建数据库"，**在 MySQL Workbench 里执行那段 SQL**（把 SQL 粘贴到查询窗口，点闪电图标执行），而不是在终端里执行；
- 数据库用户 `root` 有密码（安装时设置的那个）。

---

## 方式二：使用 WSL2

WSL2 能让你在 Windows 里运行一个真正的 Linux 系统（Ubuntu）。命令和 Mac、Linux 服务器上几乎一模一样，教程可以照着敲，也能提前熟悉以后部署时要用到的 Linux 环境。

### 1. 安装 WSL2 和 Ubuntu

1. 在开始菜单里搜索 **PowerShell**，右键选择"**以管理员身份运行**"；
2. 执行：

   ```powershell
   wsl --install
   ```

3. 执行完之后**重启电脑**；
4. 重启后会自动打开一个 Ubuntu 窗口（如果没有，在开始菜单里打开 **Ubuntu**），按提示设置 Linux 的**用户名和密码**。

::: warning 记住这个密码
以后安装软件（`sudo` 命令）时都要输入它。输入密码时屏幕上**不会显示任何字符**，这是正常的。
:::

**使用方式二时，本教程里所有的命令都在这个 Ubuntu 窗口里执行。**

先更新一下软件列表：

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Git 和基础工具

```bash
sudo apt install -y git curl build-essential
git --version
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

### 3. Node.js 22（用 nvm 安装）

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

执行完之后，**关闭 Ubuntu 窗口，再重新打开一个**，然后：

```bash
nvm install 22
node --version
```

你应该看到 `v22.xx.x`。

### 4. pnpm

```bash
npm install -g pnpm@11
pnpm --version
```

### 5. MySQL

```bash
sudo apt install -y mysql-server
sudo service mysql start
sudo mysql -e "SELECT VERSION();"
```

你应该看到版本号（8.0 或以上）。Ubuntu 上的 MySQL，`root` 用户要用 `sudo mysql` 登录。

### 6. Redis

```bash
sudo apt install -y redis-server
sudo service redis-server start
redis-cli ping
```

你应该看到 `PONG`。

::: warning 每次重启电脑后
WSL 里的 MySQL 和 Redis 不会自动启动。每次重启电脑、打开 Ubuntu 之后，先执行：

```bash
sudo service mysql start && sudo service redis-server start
```
:::

### 7. VS Code

1. 在 **Windows** 上安装 VS Code；
2. 安装扩展 **WSL**，以及 **Vue - Official**、**ESLint**、**Prettier - Code formatter**；
3. 在 Ubuntu 窗口里进入项目目录，执行 `code .`，VS Code 会以"连接到 WSL"的方式打开项目。左下角显示 `WSL: Ubuntu`，就说明连接成功了。

::: danger 项目代码要放在 Linux 里
使用 WSL2 时，项目代码请放在 Ubuntu 的目录里（比如 `~/work`），**不要**放在 `/mnt/c/...`（也就是 Windows 的 C 盘）下面，否则安装依赖和运行都会慢很多倍。
:::

项目跑起来之后，直接用 **Windows 上的浏览器**打开 `http://localhost:5173` 就能访问。

### 最后检查一遍

```bash
git --version; node --version; pnpm --version; mysql --version; redis-cli ping
```

- [ ] `git version 2.x`
- [ ] `v22.x.x`
- [ ] `11.x.x`
- [ ] `mysql  Ver 8.x …`
- [ ] `PONG`

### 方式二在后面教程中的区别

- 所有命令都在 **Ubuntu 窗口**里执行；
- 凡是写 `mysql -u root` 的地方，换成 **`sudo mysql`**。

---

全部装好了？下一步：[第一次把项目跑起来](/beginner/first-run)。
