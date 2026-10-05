# 安装开发环境（Windows）

**推荐直接在 Windows 上开发**：软件装在 Windows 里，命令在 Windows 终端（Windows Terminal）或 VS Code 的终端里执行，使用系统自带的 **Windows PowerShell 5.1**。

| 软件 | 干什么用 |
| --- | --- |
| Git for Windows | 提供 `git` 命令，用来管理代码版本 |
| Node.js 22 | 运行 JavaScript / TypeScript 程序 |
| pnpm | 下载和管理项目依赖 |
| MySQL | 数据库 |
| Memurai（Redis 兼容） | 缓存 |
| VS Code | 写代码的编辑器 |

::: info 已经验证的范围
Windows 11 + 自带的 Windows PowerShell 5.1 已经完整验证过：安装依赖、启动开发、初始化数据库、`pnpm verify`、全部测试和完整检查 `pnpm ci:local` 都能正常运行，不需要 WSL 或 Git Bash；在 cmd 命令提示符里也能安装依赖和运行 `pnpm verify`。验证时用的是 MySQL 8.4 和 Memurai 8.2。

还有几点限制：

- 没有创建文件符号链接（symlink，类似快捷方式）的权限时（没有开启“开发者模式”就是这种情况），少数检查符号链接防护的测试会自动跳过，不算失败；
- 把服务**部署到 Windows 服务器**，以及在 Windows 上**发布 App 和小程序**，还没有验证过。
:::

## 1. 打开 PowerShell

Windows 11 自带 Windows 终端，在开始菜单里搜索并打开“终端”，选择 **Windows PowerShell** 标签页。Windows 10 如果没有 Windows 终端，可以在开始菜单里搜索并打开 **Windows PowerShell**。

你应该看到类似 `PS C:\Users\你的用户名>` 的提示符。输入下面的命令，按回车：

```powershell
$PSVersionTable.PSVersion
```

你应该看到 `Major` 为 `5`、`Minor` 为 `1`。后面的命令都在这个窗口里执行；日常开发不需要以管理员身份运行。

## 2. Git for Windows

1. 打开 [Git 官网](https://git-scm.com)，下载 Windows 版并安装；安装时保留让命令行和其他软件使用 Git 的选项；
2. 装好后，**关闭终端，再重新打开 PowerShell**，让新安装的命令生效。

检查：

```powershell
git --version
```

你应该看到 `git version 2.x.x.windows.x`。

设置你的名字和邮箱：

```powershell
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

成功时没有输出，再用 `git config --global user.name` 可以看到刚才填写的名字。

## 3. Node.js 22

1. 打开 [Node.js 官网](https://nodejs.org)，选择 **22 版本**的 Windows 安装包（`.msi`），版本不能低于 `22.22.1`，安装时保持默认选项；
2. 安装完成后，**关闭终端，再重新打开 PowerShell**。

先检查 Node.js：

```powershell
node --version
```

你应该看到 `v22.xx.x`，并且不低于 `v22.22.1`。

::: tip 需要同时使用多个 Node 版本？
可以改用 **nvm-windows**（在 GitHub 上搜索 nvm-windows）。安装它之前，先在“设置 → 应用”里卸载上面安装的 Node.js；装好后执行 `nvm install 22`、`nvm use 22`（`nvm use` 可能会弹出管理员授权，点“是”）。
:::

## 4. 允许运行脚本

Windows 客户端默认的执行策略禁止运行 `.ps1` 脚本；npm 全局安装的 pnpm 会提供 `pnpm.ps1`，不调整策略就可能无法运行。

在 PowerShell 里执行：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

如果询问是否更改执行策略，输入 `Y`，按回车。这允许本机生成的脚本运行，从网上下载的脚本仍需满足签名要求；`CurrentUser` 表示**只影响当前用户**，不需要管理员权限。详见 [PowerShell 执行策略说明](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies?view=powershell-5.1)。

检查：

```powershell
Get-ExecutionPolicy -Scope CurrentUser
npm --version
```

你应该看到 `RemoteSigned` 和 npm 的版本号。

## 5. pnpm

```powershell
npm install -g pnpm@11
pnpm --version
```

等安装成功后再执行第二行，你应该看到 `11.x.x`。

## 6. MySQL

1. 打开 [MySQL 下载页](https://dev.mysql.com/downloads)，进入 **MySQL Community Server**，选择 **8.4 LTS 或更高版本**，下载 Windows 的 MSI 安装包并安装；
2. 安装结束后会打开 **MySQL Configurator**，按提示配置服务器，过程中会让你设置 **root 用户的密码**，**请记下来**；
3. 在 MySQL Configurator 里把 MySQL 配置为 Windows 服务，并设置开机自动启动，记下服务名（MySQL 8.4 的默认服务名是 `MySQL84`，以实际安装为准）；
4. 在同一个下载页单独下载并安装 **MySQL Workbench**，它是一个图形界面工具，后面建数据库时会用到。

检查：打开 **MySQL Workbench**，用 `127.0.0.1`、端口 `3306`、用户名 `root` 和刚才的密码连接本地数据库。能连上就说明 MySQL 正常运行。

::: tip SQL 在哪里执行？
后续教程中，Windows 用户在 MySQL Workbench 的查询窗口里粘贴 SQL，点击执行按钮。`mysql` 命令默认不在 Windows 的 PATH 里，不需要为了教程手动修改 PATH；也可以打开开始菜单里的 **MySQL Command Line Client**，输入 root 密码后执行 SQL。
:::

## 7. Redis：安装 Memurai

Redis 官方没有 Windows 原生版本。**Memurai** 是兼容 Redis 的 Windows 原生软件，开发者版可以用于本机开发：

1. 打开 [Memurai 官网](https://www.memurai.com)，下载 **Memurai Developer 4.x 或以上版本**并安装；
2. 安装时选择作为 Windows 服务运行，保留默认的 `6379` 端口。

::: warning 需要兼容 Redis 7.0 或以上的版本
项目用到了 Redis 7.0 才支持的命令选项（比如登录时 `PEXPIRE` 的 `NX`、`GT`、`XX` 选项），验证码还用到了 `GETDEL`。请安装 Memurai 4.x 或以上版本；Memurai 3.x 和网上一些很旧的“Redis for Windows”（3.x、5.x 版本）**不能用**，登录会失败。
:::

检查（在 PowerShell 里）：

```powershell
memurai-cli ping
```

你应该看到 `PONG`。如果提示找不到命令，在文件资源管理器里打开 Memurai 的实际安装目录，在地址栏输入 `powershell` 并按回车，然后执行：

```powershell
.\memurai-cli.exe ping
```

你应该看到 `PONG`；这里的 `.\` 表示运行当前目录里的程序。

::: tip 启动或停止数据库和缓存
按 `Win + R`，输入 `services.msc`，按回车打开“服务”。找到安装时配置的 MySQL 服务和 Memurai 服务，右键选择启动或停止。检查时，它们的状态应为“正在运行”；服务名以实际安装为准。
:::

## 8. VS Code

1. 打开 [VS Code 官网](https://code.visualstudio.com)，下载 Windows 版并安装。安装时勾选“**添加到 PATH**”；
2. 打开 VS Code，在左侧“扩展”中安装：**Vue - Official**、**ESLint**、**Prettier - Code formatter**，以及可选的 **Chinese (Simplified) Language Pack**；
3. 菜单“终端 → 新建终端”，Windows 上默认使用 PowerShell。若不是 Windows PowerShell，按 `Ctrl + Shift + P`，执行 `Terminal: Select Default Profile`，选择 **Windows PowerShell**，再新建一个终端。

你应该看到 `PS` 开头的提示符；用第 1 步的版本检查命令确认是 5.1。以后推荐在这里执行项目命令，写代码和看输出都在同一个窗口里。

## 最后检查一遍

在 PowerShell 里依次执行：

```powershell
git --version
node --version
pnpm --version
```

- [ ] `git version 2.x`
- [ ] `v22.x.x`，不低于 `v22.22.1`
- [ ] `11.x.x`
- [ ] MySQL Workbench 能连上本地数据库
- [ ] Memurai 返回 `PONG`

## 常见问题

**报“无法加载文件 …pnpm.ps1，因为在此系统上禁止运行脚本”**

执行第 4 步的 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`，确认后再运行 `pnpm --version`。如果 `npm.ps1` 报同样的错误，也用这个办法。如果提示策略被组织的组策略覆盖，需要联系学校或公司的电脑管理员。

**安装后仍然提示找不到 `git`、`node` 或 `pnpm`**

先关闭终端，再重新打开；如果用的是 VS Code，关闭并重新打开 VS Code。仍然找不到时，检查对应软件是否安装成功；Memurai 的命令还可以按第 7 步从安装目录运行。

**MySQL Workbench 连不上，或 Memurai 没有返回 `PONG`**

在“服务”里检查对应服务是否正在运行，再检查连接的端口和密码。后续教程里的数据库操作用 MySQL Workbench 执行。

全部装好了？下一步：[第一次把项目跑起来](/beginner/first-run)。

## 可选：使用 WSL2

WSL2 是 Windows 的 Linux 子系统，可以让你在 Windows 里运行 Linux 开发环境。如果你已经熟悉 Linux，也可以选择它，但完成本教程不需要安装它。选择 WSL2 后，把项目和开发软件放在 Linux 环境里，后续命令照 macOS 那一栏执行；共用命令也在 Linux 终端里运行。Linux 的软件安装和服务管理方式与 macOS、Windows 都不同（例如常见问题里给 Mac 用的 `brew services start …` 在 Linux 上不能用），请参考所选发行版的说明。
