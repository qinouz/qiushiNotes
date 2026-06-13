# 导入导出

## 状态

草稿，本次先实现 JSON 导出包。

## 背景

秋实笔记的核心承诺之一是用户数据可导出、可迁移。备份功能已经能生成整包恢复文件，但备份更像“应用内部恢复点”，不适合长期查看、迁移或给其他工具解析。

导出功能需要提供更开放的结构，让用户即使未来不用本应用，也能拿走自己的笔记元数据、正文和附件。

## 目标

- 支持导出完整 JSON 包。
- 导出包含笔记、笔记本、标签、标签关系、附件元数据和设置。
- 导出复制本地附件文件。
- 导出输出到 `userData/exports/` 下的独立目录，不覆盖旧导出。
- renderer 不直接读写文件系统。
- 导出过程不修改 SQLite 业务数据。

## 非目标

- 本次不实现导入。
- 本次不实现 Markdown/HTML 导出。
- 本次不实现选择单条笔记或单个笔记本导出。
- 本次不做云端上传。
- 本次不做导出加密。

## 用户流程

1. 用户打开设置页。
2. 用户点击“导出 JSON”。
3. main 进程读取本地 SQLite 中的用户数据表。
4. main 进程创建新的导出目录。
5. main 进程写入 `qiushi-notes.json`。
6. main 进程复制导出记录中引用到的附件文件。
7. renderer 显示导出目录、导出文件名、大小和缺失附件数量。

## UI 行为

- 设置页增加“数据导出”区域。
- 导出按钮执行完整 JSON 导出。
- 导出中禁用按钮，避免重复触发。
- 导出成功后显示导出目录。
- 如果部分附件缺失，导出仍成功，但提示缺失数量。
- 导出失败时显示错误信息。

## 数据模型

导出 JSON 顶层结构：

```ts
{
  app: 'qiushi-notes'
  format: 'qiushi-json-export'
  version: 1
  exportedAt: string
  tables: {
    notebooks: unknown[]
    notes: unknown[]
    tags: unknown[]
    noteTags: unknown[]
    attachments: unknown[]
    settings: unknown[]
  }
}
```

说明：

- `notes` 保留原始 `content` 和 `content_format`。
- `deleted_at` 原样导出，保留软删除信息。
- 不导出 `sync_queue`，因为它是未来同步内部队列，不是用户可迁移数据。
- 不导出 `note_search_index`，因为它是本地派生索引，可以重建。

## 本地存储

导出目录：

```text
userData/
  exports/
    qiushi-notes-export-2026-06-13T12-30-00-000Z/
      qiushi-notes.json
      attachments/
        2026/
          06/
            <attachment-id>.png
```

附件复制规则：

- 使用 `attachments.relative_path`。
- 只允许复制 `userData` 下的相对路径。
- 路径包含 `..` 或绝对路径时跳过并计入缺失附件。
- 源文件不存在时跳过并计入缺失附件。

## IPC / API 边界

Preload API：

```ts
window.qiushi.importExport.exportJson()
```

IPC 通道：

```text
import-export:export-json
```

main service：

```text
services/import-export-service.ts
```

## 同步影响

导出包是用户主动创建的本地文件，不参与未来同步。

未来导入时：

- 应先创建安全备份。
- 导入记录保留原 UUID。
- 如与现有记录冲突，应生成冲突副本或明确提示，而不是覆盖。

## 异常处理

- 导出目录创建失败：导出失败并提示。
- JSON 写入失败：删除未完成的临时目录。
- 附件缺失：导出继续，结果中记录缺失数量。
- 附件路径不安全：跳过该附件并记录缺失数量。
- 数据库读取失败：导出失败，不生成半成品目录。

## 隐私与数据安全

- JSON 导出包包含用户笔记正文和附件，属于敏感数据。
- 导出不自动上传。
- 错误日志不打印完整笔记正文。
- 文件复制必须限制在 `userData` 内，避免路径穿越。

## 测试计划

- 类型检查通过。
- 构建通过。
- 点击“导出 JSON”后生成新目录。
- 导出目录包含 `qiushi-notes.json`。
- JSON 中包含 notes/notebooks/attachments 等表。
- 已存在附件能复制到导出目录。
- 附件缺失时导出不失败，并显示缺失数量。

## 待确认问题

- V1 是否需要同时导出 Markdown。
- 是否需要导出范围选择：全部、当前笔记本、当前笔记。
- 是否需要让用户选择导出目录，而不是默认 `userData/exports`。

## 后续改进

- 导入 JSON 包。
- Markdown/HTML 导出。
- 导出目录选择。
- 导出后打开所在目录。
