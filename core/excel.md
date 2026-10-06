---
description: 'Excel 导出、导入模板和导入的代码说明：列定义的各个字段、分批导出与公式转义、insert 和 upsert 导入模式、失败行的错误报告和导入限制。'
---

# Excel 导入导出

用代码生成器生成模块时，勾选"导入导出"，下面这些代码就会自动生成。这一页讲清楚它们是怎么工作的，方便你修改。

## 定义列

导出、下载导入模板、导入，三个功能共用一份列定义。以图书示例为例：

```ts
// book.service.ts
export const bookColumns: ExcelColumn[] = [
  { prop: 'isbn', label: 'field.demo.book.isbn' },
  { prop: 'title', label: 'field.demo.book.title' },
  { prop: 'price', label: 'field.demo.book.price', type: 'number' },
  { prop: 'genre', label: 'field.demo.book.genre', dict: 'demo.genre' },
  { prop: 'enabled', label: 'field.demo.book.enabled', type: 'boolean', dict: 'core.enabled' },
  { prop: 'createdAt', label: 'field.common.createdAt', type: 'datetime', only: 'export' },
  { prop: 'deptId', label: 'field.demo.book.deptId', type: 'number', only: 'import' },
]
```

| 字段 | 说明 |
| --- | --- |
| `prop` | 对应的数据字段 |
| `label` | 表头，是一个翻译键。按请求的语言输出 |
| `type` | `string`（默认）、`number`、`boolean`、`datetime`。时间按请求的时区输出为 `YYYY-MM-DD HH:mm:ss` |
| `dict` | 字典编码：导出时写字典标签；导入模板里是一个下拉框；导入时既可以填标签（任何语言），也可以填值 |
| `seedName` | 导出时把种子数据的翻译键转换成文字 |
| `pick` | 选择型的列（比如部门 id）：模板里的下拉项是 `<值> - <名称>`，导入时取 ` - ` 前面的值 |
| `only` | `'export'` 只导出；`'import'` 只用于模板和导入 |
| `width` | 列宽（字符数），默认 18 |
| `literal` | 只用于导出：`label` 就是表头文字本身，不当作翻译键（比如表单字段的标题）。和单元格一样会做公式转义 |

## 导出

```ts
// book.controller.ts
@Get('export')
@RequirePerm(bookPerms.export)
@ActionLog({ domain: 'demo.book', verb: 'export' })
@ApiProduces(XLSX_TYPE)
export(@Query({ schema: bookQuery }) query: BookQuery) {
  return this.excel.export('books', bookColumns, this.books.exportRows(query))
}
```

- 导出使用和列表**相同的查询条件和排序**，但不分页；
- `exportRows` 每次读取 1000 行，一边读一边写入文件，所以导出大量数据也不会占用太多内存；
- 数据范围照样生效：用户只能导出自己看得到的数据；
- 以 `=`、`+`、`-`、`@` 开头的单元格会自动转义，防止在 Excel 里被当成公式执行。

前端调用：`exportXlsx('图书.xlsx')`（`useCrudList` 返回的方法）。

## 导入模板

```ts
@Get('import-template')
@RequirePerm(bookPerms.import)
@ApiProduces(XLSX_TYPE)
importTemplate() {
  return this.excel.template('books', bookColumns)
}
```

字典列在模板里自动带上下拉框。需要 `pick` 型的下拉框时，把选项作为第三个参数传进去，比如用户模板里的部门：

```ts
this.excel.template('users', userColumns, { deptId: await this.users.deptOptions() })
```

## 导入

控制器：

```ts
@Post('import')
@HttpCode(200)
@RequirePerm(bookPerms.import)
@Idempotent()                          // 要写在 @UploadFile 上面，这样文件内容也参与去重
@UploadFile('file', excelImportParams.maxMb, DEFAULT_EXCEL_IMPORT_LIMITS.maxMb)
@ActionLog({ domain: 'demo.book', verb: 'import' })
@ApiEnvelope(importResultVo)
importXlsx(
  @UploadedFile() file: UploadedFileData | undefined,
  @Body({ schema: importBody }) { mode }: ImportBody,     // mode: 'insert' | 'upsert'
) {
  return this.books.importXlsx(file, mode)
}
```

服务：

```ts
async importXlsx(file: UploadedFileData | undefined, mode: ImportMode): Promise<ImportResult> {
  if (!file) throw new BizError(Err.STORAGE_FILE_REQUIRED)
  // 1. 读取并逐行校验（用新增接口的 zod 规则）
  const { rows, failures } = await this.excel.read(file.buffer, bookColumns, bookCreate)
  const counts = { inserted: 0, updated: 0 }
  // 2. 每一行都通过模块自己的 create / update 写入，权限、数据范围、唯一性检查全部生效
  for (const row of rows)
    try {
      const found =
        mode === 'upsert'
          ? await this.scopedQb('t').select('t.id')
              .andWhere('t.isbn = :isbn', { isbn: row.value.isbn }).getOne()
          : null
      if (found) {
        await this.update(found.id, row.value)
        counts.updated++
      } else {
        await this.create(row.value)
        counts.inserted++
      }
    } catch (e) {
      failures.push(this.excel.failure(row, e))    // 3. 记下失败的行和原因，继续处理下一行
    }
  // 4. 返回统计结果；有失败时生成一份"错误报告"供下载
  return this.excel.result(counts, failures, bookColumns)
}
```

要点：

- **导入模式**：`insert` 只新增；`upsert` 按唯一字段（这里是 ISBN）找到已有的行就更新，找不到就新增。**只会匹配当前用户数据范围内的行**；
- **一行失败不影响其他行**。失败的行会连同错误原因生成一份 Excel 报告，保存 30 分钟，只有导入的人自己能下载；
- 表头按 `prop` 或者任意语言的翻译匹配，不区分大小写，所以中文模板和英文模板都能导入。

## 导入限制

| 参数 | 默认值 |
| --- | --- |
| `excel.import_max_mb` | 10 MB |
| `excel.import_max_rows` | 5000 行 |
| `excel.import_max_columns` | 100 列 |

这些参数可以在 **系统管理 → 参数设置** 中修改。另外，包含宏或外部链接的文件会被直接拒绝。
