# 用 Git 保存进度

**Git 就是代码的"存档"系统。** 就像玩游戏时存档一样：每完成一个功能，就保存一次。以后改坏了，可以回到任何一个存档；也能清楚地看到每一次改了什么。

## 三个最常用的命令

```bash
git status                          # 看看现在改了哪些文件
git add .                           # 把所有修改放进"待保存区"
git commit -m "feat: 课程管理"       # 保存一次，并写上说明
```

就这么简单。每完成一个小功能，就执行一次 `add` 和 `commit`。

## 完整走一遍

做完[课程管理](/beginner/first-module)之后，来保存它：

```bash
cd ~/work/qiwu-vue-admin
git status
```

你会看到一些红色的文件名，分成两类：

```text
Changes not staged for commit:          ← 修改过的已有文件
        modified:   apps/server/src/modules/biz/biz.module.ts
        modified:   apps/server/src/db/seeds/index.ts
        …

Untracked files:                        ← 新建的文件
        apps/server/src/db/migrations/20261001100000-biz-course.ts
        apps/server/src/modules/biz/biz/course/
        …
```

先看看具体改了什么：

```bash
git diff
```

绿色的 `+` 开头是新加的行，红色的 `-` 开头是删掉的行。按 `q` 退出。

确认没问题，保存：

```bash
git add .
git commit -m "feat(biz/course): 课程管理"
```

::: warning 注意 .env 文件
`apps/server/.env` 里我们改了 `CODEGEN_WRITE=true`。别担心，这个文件已经被设置为**不会被提交**（它在 `.gitignore` 里），所以 `git status` 里不会出现它。
:::

再看一下：

```bash
git status
git log --oneline
```

`git status` 显示 `nothing to commit, working tree clean`，说明全部保存好了。`git log --oneline` 会列出所有的存档，最上面一条就是你刚才保存的。

## 提交说明怎么写

本项目使用一种固定的格式：`类型(范围): 说明`

| 类型 | 用在什么时候 | 例子 |
| --- | --- | --- |
| `feat` | 新功能 | `feat(biz/course): 课程管理` |
| `fix` | 修复错误 | `fix(biz/course): 学分不能为负数` |
| `docs` | 修改文档 | `docs: 更新安装说明` |
| `refactor` | 重构代码（功能不变） | `refactor(biz/course): 简化查询条件` |
| `test` | 添加测试 | `test(biz/course): 覆盖学分上限` |

::: tip 提交被拒绝了？
项目在提交时会自动检查说明的格式，并格式化代码。如果看到提交失败，读一下报错信息，通常是格式不对，比如冒号后面少了空格，或者类型不在上面的列表里。
:::

## 后悔了怎么办

| 情况 | 命令 |
| --- | --- |
| 改坏了某个文件，还没有 add，想恢复成上次存档的样子 | `git checkout -- 文件路径` |
| 改坏了很多文件，都还没有 add，想全部恢复 | `git checkout -- .`（新建的文件要另外删除） |
| 刚刚 commit 的说明写错了 | `git commit --amend -m "新的说明"` |
| 想看某一次存档改了什么 | `git show 存档编号`（编号来自 `git log --oneline`） |

::: danger
`git checkout -- .` 会丢弃所有还没有保存的修改，**不能恢复**。执行之前先用 `git status` 和 `git diff` 确认一下。
:::

## 在 VS Code 里使用 Git

不想敲命令的话，VS Code 左侧有一个"**源代码管理**"图标（像树枝一样的图标）：

- 能看到所有修改过的文件，点击文件可以对比修改前后的内容；
- 在上方的输入框里写说明，点"**提交**"按钮，就相当于 `add` + `commit`。

两种方式可以随便切换，效果是一样的。

## 接下来

Git 还有**分支**、**远程仓库**（GitHub、Gitee）、**合并**等功能，团队协作时会用到。先把上面这几个命令用熟，等需要的时候再学也不迟。
