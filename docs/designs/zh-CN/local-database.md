# 本地数据库

## 状态

草稿

## 背景

桌面端必须在家庭服务器离线、断网、宕机时仍然可用。本地数据是事实来源，所以第一个真实功能模块是本地 SQLite 数据库。

这个模块负责创建本地数据库文件、执行迁移、建立基础表结构，并定义数据库访问边界。

## 目标

- 使用 SQLite 保存笔记、笔记本、标签、附件元数据、设置和未来同步队列。
- 数据库自动创建在 Electron `userData` 目录下。
- 迁移脚本可以安全、幂等地执行。
- 数据库访问只允许出现在 Electron main 进程。
- 数据结构提前为服务器同步预留字段。
- 用户数据必须可备份、可导出、可迁移。

## 非目标

- 本模块不实现笔记 CRUD UI。
- 本模块不实现服务器同步。
- 本模块不实现全文搜索。
- 本模块不实现备份恢复。
- 不向 renderer 暴露原始 SQL 能力。

## 用户流程

用户不会直接感知这个模块。

应用启动时：

1. 创建本地数据目录。
2. 创建 `notes.db`。
3. 执行未完成的数据库迁移。
4. 后续功能通过 main 进程服务读写数据。

如果初始化失败，后续应该显示明确错误。第一版开发阶段可以先快速失败并输出日志，但不能静默删除或重建已有数据库。

## UI 行为

第一版没有直接 UI。

后续可能增加：

- 数据目录查看。
- 手动备份。
- 全量导出。
- 数据库诊断或修复入口。

## 数据模型

第一版 schema 包含：

```text
schema_migrations
notebooks
notes
tags
note_tags
attachments
sync_queue
settings
```

### `schema_migrations`

记录已经执行过的迁移。

```text
id
name
applied_at
```

### `notebooks`

保存笔记本树节点。

```text
id
parent_id
name
sort_order
created_at
updated_at
deleted_at
version
sync_status
```

### `notes`

保存笔记正文和元数据。

```text
id
notebook_id
title
content
content_format
is_favorite
is_pinned
created_at
updated_at
deleted_at
version
sync_status
```

`content` 是文本字段。第一版富文本预计保存序列化后的 TipTap JSON。导出模块后续再转换为 HTML 或 Markdown。

### `tags`

保存标签。

```text
id
name
created_at
updated_at
deleted_at
version
sync_status
```

### `note_tags`

保存笔记和标签的多对多关系。

```text
id
note_id
tag_id
created_at
deleted_at
version
sync_status
```

关系表也使用 UUID，因为笔记和标签的绑定关系未来也需要同步。活跃关系通过 `(note_id, tag_id)` 的局部唯一索引防止重复，软删除后允许重新添加。

### `attachments`

保存附件元数据。附件二进制文件不进 SQLite，而是保存在本地附件目录。

```text
id
note_id
file_name
mime_type
size
sha256
relative_path
created_at
deleted_at
version
sync_status
```

### `sync_queue`

为未来后台同步预留。

```text
id
entity_type
entity_id
operation
payload
created_at
attempt_count
last_error
locked_at
```

### `settings`

保存本地设置。

```text
key
value
updated_at
```

## 本地存储

运行时数据目录：

```text
C:\Users\<用户名>\AppData\Roaming\QiushiNotes\
  notes.db
  attachments/
  backups/
  exports/
```

仓库中不能保存真实用户笔记、附件、备份或导出文件。

说明：

- UI 和窗口标题使用中文“秋实笔记”。
- 内部 `userData` 目录使用 ASCII 名 `QiushiNotes`，避免 Windows `cmd.exe` 或脚本工具显示中文路径时乱码。
- 早期开发版本如果已经创建了 `AppData\Roaming\秋实笔记\notes.db`，应用启动时会在新目录没有数据库的情况下自动迁移一次。
- 自动化验证使用 `QIUSHI_USER_DATA_DIR` 指向仓库 `.tmp/` 隔离目录时，可以设置 `QIUSHI_SKIP_LEGACY_MIGRATION=1` 跳过旧目录迁移，避免把真实用户数据拷贝进测试目录。

## IPC / API 边界

renderer 不能直接访问 SQLite。

允许路径：

```text
renderer -> preload typed API -> main IPC handler -> main service -> database
```

本模块只提供数据库基础设施。后续功能模块再暴露具体能力：

```text
notes.create
notes.update
notebooks.list
attachments.save
search.query
```

## 同步影响

即使第一版不做同步，记录也要包含：

```text
version
sync_status
deleted_at
```

规则：

- 未来需要同步的用户数据都使用 UUID。
- 删除默认走 `deleted_at` 软删除。
- 离线修改保留在本地。
- 表结构不能依赖服务器生成 ID。
- 后续冲突副本要能保存下来。

第一版同步状态：

```text
local
pending
synced
conflicted
```

## 异常处理

可能失败的情况：

- 用户数据目录无法创建。
- 数据库文件无法打开。
- 迁移失败。
- 数据库锁定或损坏。

第一版处理：

- 启动时初始化失败就抛错。
- 日志中记录失败的迁移名称。
- 不自动删除或重建已有数据库。

后续改进：

- 显示可理解的恢复页面。
- 修复前先提示备份。
- 尽可能从可读数据中导出。

## 隐私与数据安全

- 数据库默认只在本地。
- 第一版不会发送数据库内容到服务器。
- 附件以文件形式保存，方便备份和检查。
- 删除默认软删除。
- 后续 AI 功能必须尊重敏感笔记禁止上传的规则。

## 实现选择

第一版使用 Electron main 进程 Node 运行时提供的 SQLite 能力。

原因：

- 避免第一阶段就处理 Windows 原生模块编译。
- 数据库访问仍然只在 main 进程。
- 数据库层足够小，后续如果需要可以替换。

后续可能替换为：

- `better-sqlite3`，如果内置 SQLite 在迁移、备份、性能或打包上不够用。

## 测试计划

- workspace 类型检查通过。
- desktop 构建通过。
- Electron 运行时可以使用 SQLite。
- 第一次启动能创建数据目录和 `notes.db`。
- 重复启动不会重复执行已完成迁移。
- 外键约束开启。

## 待确认问题

- 笔记正文是否只存 TipTap JSON，还是额外存纯文本字段用于搜索摘要？
- FTS 表放在第一版数据库迁移，还是搜索模块迁移？
- 后续是否支持一条笔记挂到多个笔记本？
- 数据库备份用 SQLite 在线备份 API，还是应用关闭时做文件快照？

## 后续改进

- 增加全文搜索迁移。
- 增加备份和恢复服务。
- 增加数据库诊断。
- 增加导出服务。
- 为每个功能模块增加类型化 repository。
