---
description: '写给新手的终端入门：在 Mac 终端和 Windows PowerShell 里用 pwd、ls、cd 等常用命令，理解提示符和路径，处理 command not found。'
---

# 终端入门

程序员很多操作都是在**终端**（也叫命令行）里完成的：输入一行命令，按回车，电脑就会执行。刚开始会觉得不习惯，但只要掌握下面这十几个命令，就足够完成本教程了。

## 打开终端

- **Mac**：按 `⌘ + 空格`，输入"终端"或者 `Terminal`，按回车；
- **Windows**：在开始菜单搜索“终端”，打开 **Windows 终端**（Windows 11 自带），选择 **Windows PowerShell** 标签页；Windows 10 如果没有 Windows 终端，直接搜索并打开 **Windows PowerShell**。详见[安装环境（Windows）](/beginner/install-windows)；
- **VS Code 里**：菜单"终端 → 新建终端"，或者按 `` Ctrl + ` ``。**推荐用这种方式**，写代码和执行命令都在同一个窗口里。Windows 上默认使用 PowerShell；如果打开的是其他终端，用命令面板里的 `Terminal: Select Default Profile` 选择 **Windows PowerShell**，再新建终端。

打开之后，你会看到类似这样的一行，后面跟着一个闪烁的光标：

```text
xiaoming@MacBook ~ %
```

这是 Mac 上的**提示符**，意思是"我准备好了，请输入命令"。`~` 表示你当前所在的位置是自己的"家目录"。Windows PowerShell 里通常显示为：

```text
PS C:\Users\xiaoming>
```

Windows 终端是显示命令行的窗口，PowerShell 是里面执行命令的程序。本教程以 Windows 自带的 **Windows PowerShell 5.1** 为准。

## 规则

- 输入命令，**按回车**执行；
- Mac 命令区分大小写；PowerShell 的命令名通常不区分大小写，但软件参数和项目路径仍建议照教程输入；
- 命令和参数之间用**空格**隔开；
- 本教程中的命令块，**选择适合自己系统的标签后复制、粘贴到终端**（Mac 用 `⌘ + V`；Windows 终端默认可用 `Ctrl + V`、`Ctrl + Shift + V` 或右键；VS Code 的 Windows 终端用 `Ctrl + V`）；
- **不要复制提示符**（如 `PS C:\Users\xiaoming>`、`%` 或 Mac 命令行开头的 `$`）。PowerShell 命令里的 `$env:名称` 和 `$变量名` 是命令的一部分，要保留。

## 常用命令

下面的 `pwd`、`ls`、`cd`、`mkdir`、`cat`、`clear` 在 PowerShell 里也能用：它们是对应 PowerShell 命令的别名或快捷函数。不过**输出格式和 macOS 不一样，参数也不一定通用**，有区别的地方会分两栏。

### 我在哪里？`pwd`

```bash
pwd
```

你应该看到：

```text
/Users/xiaoming
```

这就是你当前所在的文件夹（**目录**）。PowerShell 会显示一个 `Path` 表格，路径类似 `C:\Users\xiaoming`。

### 这里有什么？`ls`

```bash
ls
```

列出当前目录里的文件和文件夹。PowerShell 通常显示包含 `Mode`、`LastWriteTime`、`Length`、`Name` 的表格；看 `Name` 一列就能找到文件名。

### 进入文件夹：`cd`

```bash
cd Desktop          # 进入 Desktop 文件夹
cd ..               # 回到上一级
cd ~                # 回到家目录
cd ~/work/qiwu      # 一次进入多层
```

`#` 后面的是**注释**，只是给人看的说明，执行时会被忽略。

::: tip 按 Tab 自动补全
输入文件夹名的前几个字母，按 `Tab` 键，终端会自动补全剩下的部分。这能省很多事，也能避免打错字。
:::

### 新建文件夹：`mkdir`

::: code-group

```bash [macOS]
mkdir -p ~/work       # -p 的意思是：如果上级目录不存在，也一起创建
```

```powershell [Windows（PowerShell）]
New-Item -ItemType Directory -Force ~/work
```

:::

Mac 的 `mkdir -p` 不适用于 PowerShell；Windows 这一栏用 `New-Item` 创建目录，`-Force` 让目录已存在时也能继续。你应该能在 `ls ~` 的结果里看到 `work`。

### 查看文件内容：`cat`

```bash
cat package.json
```

### 停止正在运行的程序：`Ctrl + C`

有些命令（比如启动服务器）会一直运行下去，不会自己结束。想停止它时，在终端里按 **`Ctrl + C`**（Mac 上也是 Ctrl，不是 ⌘）。

### 清屏：`clear`

终端里的输出太多，看着乱的时候：

```bash
clear
```

### 翻出上一条命令：`↑`

按键盘上的 **↑ 方向键**，可以翻出之前执行过的命令，不用重新输入。

## 路径

**路径**就是文件或文件夹的"地址"：

```text
/Users/xiaoming/work/qiwu-vue-admin/apps/web/src/main.ts
```

- **绝对路径**：Mac 从 `/` 开始；Windows 通常从盘符开始，例如 `C:\Users\xiaoming\work\qiwu-vue-admin\apps\web\src\main.ts`；
- **相对路径**：从当前目录开始算，比如在 `qiwu-vue-admin` 目录里，`apps/web` 就指向 `qiwu-vue-admin/apps/web`；
- `~` 表示家目录，`.` 表示当前目录，`..` 表示上一级目录；PowerShell 也能识别教程里的 `~/work`、`apps/server` 这类路径；
- 路径里有空格时，加引号，例如 `cd "C:\Users\xiaoming\My Projects"`。

## 练习

依次执行下面的命令，看看每一步输出了什么：

::: code-group

```bash [macOS]
cd ~
mkdir -p ~/work/practice
cd ~/work/practice
pwd
ls
cd ..
ls
```

```powershell [Windows（PowerShell）]
cd ~
New-Item -ItemType Directory -Force ~/work/practice
cd ~/work/practice
pwd
ls
cd ..
ls
```

:::

::: details 你应该看到
- Mac 的 `pwd` 输出 `/Users/你的用户名/work/practice`；PowerShell 的 `Path` 一栏显示 `C:\Users\你的用户名\work\practice`；
- 第一个 `ls` 没有输出，因为这个文件夹是空的；
- `cd ..` 回到了 `work` 目录，第二个 `ls` 输出 `practice`。
:::

## 看到"command not found"

```text
zsh: command not found: pnpm
```

Windows 对应的提示通常是“无法将‘pnpm’项识别为 cmdlet、函数、脚本文件或可运行程序的名称”。

意思是"找不到这个命令"，通常是因为**这个软件还没有安装**，或者**安装之后没有重新打开终端**。安装软件之后，关掉终端再重新打开一个，通常就好了。

下一步：安装开发环境（[Mac](/beginner/install-mac) 或 [Windows](/beginner/install-windows)）。
