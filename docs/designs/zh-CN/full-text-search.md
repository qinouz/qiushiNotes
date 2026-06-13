# 全文搜索

## 状态

草稿

## 背景

V1 PRD 要求支持本地全文搜索。当前界面中的搜索主要是 renderer 内存过滤，只能覆盖已经加载到树里的标题和摘要，不能稳定搜索完整正文，也没有 main 进程的本地数据边界。

搜索必须离线可用，不能依赖服务器。它还必须能搜索 TipTap JSON 正文中的真实文本，而不是让用户搜到 JSON 字段名或格式噪声。

## 目标

- 支持按关键词搜索未删除笔记的标题和正文。
- 搜索在本地 SQLite 数据库上完成。
- 搜索正文使用从 TipTap JSON 提取出的纯文本。
- 新建、编辑、删除、恢复笔记时同步维护搜索索引。
- 搜索结果返回标题、摘要、更新时间和所在笔记本 ID，供 UI 定位。

## 非目标

- 暂不搜索附件内容。
- 暂不搜索图片 OCR。
- 暂不搜索已删除笔记；回收站后续可以单独支持。
- 暂不做复杂查询语法、布尔查询、分词高亮。
- 暂不引入新的原生 SQLite 依赖。

## 用户流程

1. 用户在搜索框输入关键词。
2. renderer 调用 `window.qiushi.search.query({ query })`。
3. main 进程在本地搜索索引中查找标题或正文命中的未删除笔记。
4. 中间栏展示搜索结果。
5. 用户点击结果后打开对应笔记。

## UI 行为

- 搜索框为空时展示正常笔记树。
- 搜索框有内容时展示搜索结果列表，而不是继续展示完整笔记本树。
- 搜索结果显示标题、正文摘要、更新时间。
- 搜索中显示加载状态。
- 没有结果时显示“没有找到相关笔记”。
- 搜索失败时显示错误信息。

## 数据模型

当前 Electron/Node 运行时使用 `node:sqlite`。本机验证结果：

```text
sqlite_version() = 3.47.2
FTS3/FTS4/FTS5 均不可用
```

因此 V1 先使用普通 SQLite 表维护搜索索引：

```text
note_search_index
  note_id TEXT PRIMARY KEY
  title TEXT NOT NULL
  content_text TEXT NOT NULL
  updated_at TEXT NOT NULL
```

搜索查询使用参数化 `LIKE`：

```sql
WHERE notes.deleted_at IS NULL
  AND (title LIKE ? ESCAPE '\\' OR content_text LIKE ? ESCAPE '\\')
```

这不是最终理想的 FTS 方案。它适合 V1 的小规模数据和本地优先验证，后续如果切换到支持 FTS5 的 SQLite 运行时，再新增迁移把索引表替换为虚拟 FTS 表。

## 本地存储

- 搜索索引存放在 `notes.db` 中。
- `content_text` 是正文纯文本副本，只用于本地搜索。
- 不生成额外文件。
- 不上传搜索关键词或索引内容。

## IPC / API 边界

Preload API：

```ts
window.qiushi.search.query({ query })
```

IPC 通道：

```text
search:query
```

Main service：

```text
services/search-service.ts
```

Note service 在这些操作后维护索引：

- `createNote`
- `updateNote`
- `softDeleteNote`
- `restoreNote`

应用启动后执行一次索引重建，用来补齐旧数据或迁移后的缺口。

## 同步影响

搜索索引是本地派生数据，不参与未来同步。

未来同步拉取远端笔记后，只需要按本地最终记录重建或更新搜索索引。冲突副本如果作为独立笔记保存，也会自然进入索引。

## 异常处理

- 查询为空：返回空数组，不查库。
- 查询过长：截断或拒绝，避免 UI 卡顿。
- 索引缺失：启动重建或在查询失败时提示用户重试。
- TipTap JSON 无法解析：降级按原始文本去掉明显结构字符后索引。
- 索引更新失败：笔记写入仍以本地数据为准，但应抛错让调用方感知。

## 隐私与数据安全

- 搜索关键词不写入日志。
- 搜索索引只保存在本地数据库。
- 搜索结果不包含完整正文，只返回摘要。
- SQL 使用参数化查询，不拼接用户输入。

## 测试计划

- 新建笔记后能搜到标题。
- 编辑正文后能搜到正文关键词。
- 删除笔记后普通搜索搜不到。
- 从回收站恢复后能重新搜到。
- TipTap JSON 正文不会把 JSON 字段名作为主要搜索内容。
- 运行 `pnpm.cmd typecheck`。
- 运行 `pnpm.cmd --filter desktop build`。

## 待确认问题

- 是否需要为中文搜索做更好的分词或拼音搜索。
- 是否在 V1 引入支持 FTS5 的 SQLite 依赖。
- 搜索结果是否需要高亮命中片段。

## 后续改进

- 切换到 FTS5 虚拟表。
- 支持标签、笔记本范围过滤。
- 支持搜索附件文本和 OCR 结果。
- 增加搜索结果命中高亮和排序权重。
