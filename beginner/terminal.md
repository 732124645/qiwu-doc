# 终端入门

程序员很多操作都是在**终端**（也叫命令行）里完成的：输入一行命令，按回车，电脑就会执行。刚开始会觉得不习惯，但只要掌握下面这十几个命令，就足够完成本教程了。

## 打开终端

- **Mac**：按 `⌘ + 空格`，输入"终端"或者 `Terminal`，按回车；
- **Windows**：直接在 Windows 上开发的话，打开 **Git Bash**（安装 Git 时自带）；使用 WSL2 的话，打开 **Ubuntu**。详见[安装环境（Windows）](/beginner/install-windows)；
- **VS Code 里**：菜单"终端 → 新建终端"，或者按 `` Ctrl + ` ``。**推荐用这种方式**，写代码和执行命令都在同一个窗口里。

打开之后，你会看到类似这样的一行，后面跟着一个闪烁的光标：

```text
xiaoming@MacBook ~ %
```

这叫**提示符**，意思是"我准备好了，请输入命令"。`~` 表示你当前所在的位置是自己的"家目录"。

## 规则

- 输入命令，**按回车**执行；
- 命令的大小写有区别，`ls` 和 `LS` 不一样；
- 命令和参数之间用**空格**隔开；
- 本教程中的命令块，**可以直接复制，粘贴到终端**里（Mac 用 `⌘ + V`，Windows 终端用 `Ctrl + Shift + V` 或者右键）；
- 教程命令块里不会有开头的 `$` 或 `%`，那是提示符，**不要复制**。

## 常用命令

### 我在哪里？`pwd`

```bash
pwd
```

你应该看到：

```text
/Users/xiaoming
```

这就是你当前所在的文件夹（**目录**）。

### 这里有什么？`ls`

```bash
ls
```

列出当前目录里的文件和文件夹。

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

```bash
mkdir -p ~/work       # -p 的意思是：如果上级目录不存在，也一起创建
```

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

- **绝对路径**：从 `/` 开始，写完整的地址；
- **相对路径**：从当前目录开始算，比如在 `qiwu-vue-admin` 目录里，`apps/web` 就指向 `qiwu-vue-admin/apps/web`；
- `~` 表示家目录，`.` 表示当前目录，`..` 表示上一级目录。

## 练习

依次执行下面的命令，看看每一步输出了什么：

```bash
cd ~
mkdir -p ~/work/practice
cd ~/work/practice
pwd
ls
cd ..
ls
```

::: details 你应该看到
- `pwd` 输出 `/Users/你的用户名/work/practice`；
- 第一个 `ls` 没有输出，因为这个文件夹是空的；
- `cd ..` 回到了 `work` 目录，第二个 `ls` 输出 `practice`。
:::

## 看到"command not found"

```text
zsh: command not found: pnpm
```

意思是"找不到这个命令"，通常是因为**这个软件还没有安装**，或者**安装之后没有重新打开终端**。安装软件之后，关掉终端再重新打开一个，通常就好了。

下一步：安装开发环境（[Mac](/beginner/install-mac) 或 [Windows](/beginner/install-windows)）。
