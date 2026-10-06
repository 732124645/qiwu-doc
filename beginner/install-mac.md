---
description: '在 Mac 上依次安装 Xcode 命令行工具、Homebrew、Node.js 22、pnpm、MySQL、Redis 和 VS Code，每一步都用命令确认装好。'
---

# 安装开发环境（Mac）

要安装的东西有点多，但每一样都是做开发必备的，**装一次，以后一直能用**。

| 软件 | 干什么用 |
| --- | --- |
| Xcode 命令行工具 | 苹果提供的基础开发工具，包含 Git |
| Homebrew | Mac 上的"应用商店"，用一条命令安装各种开发软件 |
| Node.js 22 | 运行 JavaScript / TypeScript 程序（前端和后端都需要它） |
| pnpm | 下载和管理项目依赖的第三方代码包 |
| MySQL | 数据库 |
| Redis | 缓存 |
| VS Code | 写代码的编辑器 |

每装完一样，都要**用命令检查一下是否安装成功**，再装下一样。

## 1. Xcode 命令行工具

打开终端，执行：

```bash
xcode-select --install
```

会弹出一个窗口，点"安装"，等它完成（可能要十几分钟）。

::: tip
如果提示 `command line tools are already installed`，说明已经装过了，直接进入下一步。
:::

检查：

```bash
git --version
```

你应该看到类似 `git version 2.xx.x` 的输出。

## 2. Homebrew

执行 Homebrew 官网（brew.sh）提供的安装命令：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

过程中会要求输入**电脑的开机密码**。输入时屏幕上**不会显示任何字符**，这是正常的，输完直接按回车。

安装结束时，终端会提示你执行两三行命令，把 `brew` 加到环境变量里（M 系列芯片的 Mac 一般是下面这样）。**请照着终端实际显示的命令执行**：

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

检查：

```bash
brew --version
```

你应该看到 `Homebrew 4.x.x` 或者更高的版本号。

::: warning 下载很慢或者失败？
Homebrew 需要从国外服务器下载。如果一直卡住或者报网络错误，可以搜索"Homebrew 国内镜像"，按照镜像站（比如清华、中科大）的说明配置之后再试。
:::

## 3. Node.js 22

```bash
brew install node@22
```

安装完成后，终端会提示 `node@22` 是 "keg-only"，需要把它加到 PATH 里。执行：

```bash
echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

检查：

```bash
node --version
npm --version
```

你应该看到 `v22.xx.x`（第一个数字必须是 22，并且不低于 `v22.22.1`），以及 npm 的版本号。

::: tip 已经装过别的 Node 版本？
执行 `node --version`，如果看到的不是 22，说明电脑上还有别的 Node。可以使用版本管理工具 nvm 来切换版本：安装 nvm 之后，执行 `nvm install 22` 和 `nvm use 22`。
:::

## 4. pnpm

```bash
npm install -g pnpm@11.28.3
```

检查：

```bash
pnpm --version
```

你应该看到 `11.28.3`。

## 5. MySQL

推荐安装 **MySQL 8.4**（自动测试使用的版本）。用 Homebrew 安装：

```bash
brew install mysql
brew services start mysql
```

第二条命令会启动 MySQL，并且以后开机自动启动。

检查（刚安装的 MySQL，`root` 用户没有密码）：

```bash
mysql -u root -e "SELECT VERSION();"
```

你应该看到一个表格，里面是 MySQL 的版本号，确认是 **8.4 或以上**。

::: warning 报错 `Can't connect to local MySQL server`
MySQL 还没有启动完成。等 10 秒再试一次；还不行的话，执行 `brew services list`，看看 mysql 的状态是不是 `started`。
:::

## 6. Redis

需要 **Redis 7.0 及以上**，支持 `GETDEL` 和 `PEXPIRE` 的 `NX`/`XX`/`GT` 选项。用 Homebrew 安装：

```bash
brew install redis
brew services start redis
```

检查：

```bash
redis-cli ping
```

你应该看到：

```text
PONG
```

## 7. VS Code

1. 打开 VS Code 官网（code.visualstudio.com），下载 Mac 版，拖到"应用程序"文件夹；
2. 打开 VS Code，按 `⌘ + Shift + P`，输入 `shell command`，选择 **Shell Command: Install 'code' command in PATH**。之后就可以在终端里用 `code 文件夹` 打开项目了；
3. 点左侧的"扩展"图标（四个小方块），搜索并安装这几个扩展：

| 扩展 | 作用 |
| --- | --- |
| **Chinese (Simplified) Language Pack** | 中文界面（可选） |
| **Vue - Official** | 支持 `.vue` 文件的语法高亮和提示 |
| **ESLint** | 实时提示代码问题 |
| **Prettier - Code formatter** | 自动格式化代码 |

## 8. 设置 Git 的名字和邮箱

以后保存代码时会记录是谁做的修改：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

## 9. （可选）数据库图形界面

用命令行看数据库不太直观，可以装一个图形界面工具，比如免费的 **DBeaver**（dbeaver.io）。装好之后新建一个 MySQL 连接，主机 `127.0.0.1`，端口 `3306`，用户 `root`，密码留空。

## 最后检查一遍

把下面的命令一次性粘贴到终端里执行：

```bash
git --version; node --version; pnpm --version; mysql --version; redis-cli ping
```

对照一下：

- [ ] `git version 2.x`
- [ ] `v22.x.x`
- [ ] `11.28.3`
- [ ] `mysql  Ver …`
- [ ] `PONG`

全部都有了？下一步：[第一次把项目跑起来](/beginner/first-run)。
