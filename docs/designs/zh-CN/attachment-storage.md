# 附件与图片粘贴设计

## 状态

草稿，随图片粘贴 MVP 一起实现。

## 背景

富文本编辑器已经接入 TipTap，下一步需要支持最常见的笔记场景：粘贴图片。图片不能直接以 base64 形式写入正文，也不能写死本机绝对路径，否则后续备份、导出和云同步都会变得脆弱。

业界成熟项目的共同做法是：正文只保存资源引用，二进制文件独立存储和同步。Joplin 使用 resource 模型，Outline 把文件交给本地目录或对象存储，Logseq 强调可迁移的 assets 目录。本项目采用类似路线：本地附件表 + 本地附件目录 + 正文引用附件 ID。

## 目标

- 富文本普通笔记支持粘贴图片。
- 粘贴图片先通过 preload/IPC 交给 main 进程保存。
- main 进程把图片保存到 `userData/attachments/yyyy/mm/`。
- SQLite `attachments` 表记录附件元数据。
- TipTap 正文插入图片节点，节点保存 `attachmentId` 和 `qiushi-attachment://<id>`。
- renderer 不能直接写本地文件。
- 正文不保存 base64。
- 正文不保存 Windows/macOS 绝对路径。
- 本地备份包自动包含附件目录。

## 非目标

- 不做图片缩放、裁剪、压缩和格式转换。
- 不做拖拽上传。
- 不做附件列表管理器。
- 不做附件删除和垃圾回收。
- 不做云端上传；本模块只为后续同步打基础。
- 不支持非图片附件粘贴。

## 用户流程

1. 用户打开普通富文本笔记。
2. 用户从截图工具、浏览器或文件管理器复制图片。
3. 用户在编辑器正文粘贴。
4. renderer 从剪贴板读取图片文件。
5. renderer 把图片二进制、文件名、MIME 类型和当前笔记 ID 传给 preload。
6. main 进程校验图片类型和大小。
7. main 进程写入本地附件文件并插入 `attachments` 记录。
8. renderer 在 TipTap 当前光标处插入图片节点。
9. 现有自动保存把 TipTap JSON 写入 `notes.content`。

## UI 行为

- 粘贴图片后立即在编辑器中显示。
- 图片按编辑器宽度自适应，最大宽度不超过正文宽度。
- 保存失败时显示现有错误消息，不插入损坏图片节点。
- Markdown 笔记第一版不拦截图片粘贴，仍保持源码编辑。
- 如果图片保存过程中用户切换了笔记，不把图片插入新笔记，避免内容串写。

## 数据模型

继续使用已有 `attachments` 表：

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

约定：

- `id` 使用 UUID。
- `note_id` 指向当前笔记。
- `relative_path` 保存相对于 `userData` 的 POSIX 风格路径，例如 `attachments/2026/06/<id>.png`。
- `sha256` 用于后续同步去重和完整性校验。
- `sync_status` 初始为 `local`，后续同步引擎接管。

TipTap 图片节点：

```json
{
  "type": "image",
  "attrs": {
    "src": "qiushi-attachment://<id>",
    "attachmentId": "<id>",
    "alt": "原始文件名"
  }
}
```

## 本地存储行为

- 文件写入 `userData/attachments/yyyy/mm/<id>.<ext>`。
- 扩展名由 MIME 类型决定，避免信任剪贴板文件名。
- 第一版允许 `image/png`、`image/jpeg`、`image/gif`、`image/webp`。
- 单张图片大小上限暂定 20 MB。
- 如果数据库写入失败，已写入的文件应删除，避免孤儿文件。

## IPC / API 边界

preload API：

```ts
window.qiushi.attachments.saveImageFromPaste(input)
```

IPC 通道：

```text
attachments:save-image-from-paste
```

输入：

```ts
{
  noteId: string
  fileName: string
  mimeType: string
  data: ArrayBuffer
}
```

输出：

```ts
{
  id: string
  noteId: string
  fileName: string
  mimeType: string
  size: number
  sha256: string
  relativePath: string
  url: string
}
```

图片显示协议：

```text
qiushi-attachment://<id>
```

main 进程注册自定义协议，按附件 ID 查询 SQLite，再从本地附件目录返回文件内容。

## 同步影响

- 图片附件后续作为独立同步对象处理。
- `attachments` 元数据走普通数据库同步。
- 二进制文件按 `sha256` 或对象 key 上传到服务器。
- 其他设备拉取笔记后，如果发现本地缺少附件文件，再按附件 ID 下载。
- 删除笔记不立即物理删除图片，避免同步和恢复阶段误删。

## 错误处理和边界

- 非图片 MIME 拒绝保存。
- 超过大小限制拒绝保存。
- 当前笔记不存在或已删除时拒绝保存。
- 自定义协议只允许按附件 ID 读取，不接受任意路径。
- 附件记录不存在或文件丢失时返回 404。
- 写文件成功但写数据库失败时删除文件。
- 保存图片期间用户切换笔记时，已保存附件可能短暂成为孤儿附件；后续附件清理模块负责回收。

## 隐私和数据安全

- 图片只保存到本地 `userData`。
- renderer 无法直接选择写入路径。
- 图片 URL 不暴露真实绝对路径。
- 备份文件会包含图片，需要和笔记一样妥善保存。

## 测试和验证计划

- 类型检查通过。
- 构建通过。
- 粘贴 PNG/JPEG 图片后能在编辑器显示。
- `attachments` 表出现对应记录。
- 本地 `attachments/yyyy/mm/` 出现图片文件。
- TipTap JSON 中没有 base64。
- TipTap JSON 中没有本机绝对路径。
- 备份仍能包含附件目录。

## 后续改进

- 图片拖拽上传。
- 图片尺寸调整。
- 附件列表和删除。
- 附件孤儿清理。
- 云端附件上传下载。
