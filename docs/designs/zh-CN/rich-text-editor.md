# 富文本编辑器设计

## 状态

草稿，随本次 TipTap MVP 实现一起落地。

## 背景

当前编辑器使用 `textarea` 保存纯文本，已经验证了本地 SQLite、IPC、自动保存和文件树选中流程。V1 PRD 要求普通笔记支持富文本编辑，并且项目技术方向已经选择 TipTap。

本模块的第一目标不是一次性复刻完整笔记软件，而是先把普通笔记从纯文本编辑升级到可序列化、可离线保存、可继续扩展图片和导出的富文本内核。

## 社区成熟项目参考

本轮实现前参考了以下开源或社区成熟方向：

- TipTap 官方项目：TipTap 是基于 ProseMirror 的 headless 富文本框架，强调扩展化和自定义 UI。它适合作为本项目的编辑器内核，但不会替我们决定产品交互。
- Awesome Tiptap 社区列表：社区里大量项目使用 TipTap 构建 WYSIWYG、文档、CMS、知识库和邮件编辑器，说明 TipTap JSON 作为结构化内容载体是成熟路线。
- Novel：开源 Notion 风格 WYSIWYG 编辑器，证明 TipTap 可以支撑更现代的块式体验；但 Novel 偏 React/AI/在线产品，本项目 V1 不直接照搬斜杠菜单、AI 补全和块拖拽。
- Outline / rich-markdown-editor：成熟知识库产品强调快速、协作和 Markdown 兼容。它提醒我们保留 Markdown 笔记路径是有价值的，但 Outline 的团队权限、协作和发布能力不进入 V1。
- AFFiNE / BlockSuite：代表更重的块编辑、白板和本地优先协作方向。它对长期路线有启发，但当前私有云笔记 V1 先避免自研复杂块编辑框架。

本项目采用的取舍：
- 第一版做“文档型富文本”，不做完整块编辑器。
- 普通笔记和 Markdown 笔记分流保存，避免强行双向转换导致数据损坏。
- 先保证本地保存、可恢复、可导出基础，再扩展图片、表格、附件和块操作。

## 目标

- 普通笔记使用 TipTap 编辑器。
- Markdown 笔记继续使用纯文本编辑区域，避免两种编辑范式互相覆盖。
- 新建普通笔记时使用 `content_format = 'tiptap-json'`。
- 旧的 `plain-text` 普通笔记可以被 TipTap 读取，并在下一次自动保存时升级为 `tiptap-json`。
- 富文本内容保存为 TipTap JSON 字符串，继续写入本地 SQLite 的 `notes.content`。
- 自动保存沿用现有 800ms 防抖流程。
- 工具栏支持加粗、斜体、下划线、标题、无序列表、有序列表、待办列表、引用、代码块、分割线、撤销和重做。
- 工具栏支持对选中文本或后续输入设置字号和行距。
- 笔记列表和文件夹卡片摘要显示富文本纯文本预览，而不是 JSON 原文。

## 非目标

- 不实现图片粘贴、附件引用和本地附件落盘。
- 不实现表格。
- 不实现 Markdown 与富文本的双向转换。
- 不实现浮动气泡菜单、斜杠菜单和块编辑器。
- 不实现富文本 HTML 清洗和只读渲染视图；当前只在 TipTap 编辑器内展示用户自己的本地内容。
- 不新增数据库迁移，继续使用已经存在的 `notes.content` 和 `notes.content_format` 字段。

## 用户流程

1. 用户打开普通笔记。
2. 编辑器检测 `content_format`。
3. 如果是 `tiptap-json`，解析 JSON 并交给 TipTap。
4. 如果是旧的 `plain-text`，将文本按换行转换为 TipTap 段落。
5. 用户编辑标题或正文。
6. TipTap 更新时把文档 JSON 序列化为字符串并触发现有自动保存。
7. 保存普通笔记时同时写入 `content_format = 'tiptap-json'`。
8. 用户打开 Markdown 笔记时仍然看到纯文本编辑区域，内容按原样保存为 `markdown`。

## UI 行为

- 标题输入仍在编辑器顶部。
- 普通笔记标题下方显示富文本工具栏。
- Markdown 笔记标题栏显示 Markdown 标识，并使用纯文本编辑区。
- 工具栏按钮使用图标和简短文本组合，按钮激活时显示选中状态。
- 字号和行距使用紧凑下拉框，放在富文本工具栏左侧；选择“默认”时移除当前文本样式，回到编辑器基础样式。
- 如果未选中笔记，显示空状态，不初始化 TipTap。
- 富文本编辑区占满右侧剩余空间，滚动发生在编辑区内部。

## 数据模型

继续使用 `notes` 表：

```text
content TEXT NOT NULL DEFAULT ''
content_format TEXT NOT NULL DEFAULT 'tiptap-json'
```

V1 当前支持：

- `content_format = 'tiptap-json'`：普通富文本笔记，`content` 是 TipTap JSON 字符串。
- `content_format = 'plain-text'`：旧普通纯文本笔记，只作为兼容输入，保存后升级。
- `content_format = 'markdown'`：Markdown 笔记，`content` 是 Markdown 源文本。
- 字号和行距作为 TipTap `textStyle` mark 的属性保存到 `content` JSON 中，不新增 SQLite 字段；这样不同文本片段可以保留不同排版，同时不会影响现有自动保存和未来同步记录边界。

TipTap 空文档约定：

```json
{"type":"doc","content":[{"type":"paragraph"}]}
```

## 本地存储行为

- renderer 不直接访问 SQLite。
- 自动保存仍通过 `window.qiushi.notes.update(...)`。
- main service 对 `contentFormat` 做白名单归一化，拒绝 renderer 任意写入格式字符串。
- 普通笔记保存时写入 `content_format = 'tiptap-json'`，便于未来导出模块识别。
- Markdown 笔记保存时不改变 `content_format`。
- 默认正文行距应保持接近普通笔记应用的阅读密度；当前 CSS 默认行距为 `1.62`，用户选择的行距才写入 TipTap JSON。

## IPC / API 边界

`CreateNoteInput` 和 `UpdateNotePatch` 支持：

```ts
contentFormat?: 'plain-text' | 'markdown' | 'tiptap-json'
```

renderer 调用：

```ts
window.qiushi.notes.create({ notebookId, contentFormat: 'tiptap-json' })
window.qiushi.notes.update(id, { title, content, contentFormat: 'tiptap-json' })
```

## 同步影响

- 富文本内容作为本地记录的一部分参与未来同步。
- `version`、`updated_at`、`sync_status` 仍由 main service 统一维护。
- 未来冲突处理应保留完整 TipTap JSON 副本，不做字段级合并。

## 错误处理和边界

- TipTap JSON 解析失败时，把原始内容作为纯文本段落打开，避免用户看不到内容。
- 空正文保存为空 TipTap 文档 JSON，而不是空字符串。
- 摘要提取失败时返回空字符串，不把 JSON 结构泄漏到列表。
- 切换笔记前仍先 flush 待保存草稿，避免丢失当前编辑。

## 隐私和数据安全

- 富文本内容只保存在本地 SQLite。
- 第一版不加载远程图片，不自动访问外部链接。
- 链接仅作为文本标记保存，点击打开策略后续单独设计。

## 测试和验证计划

- 类型检查通过。
- 构建通过。
- 新建普通笔记后 `contentFormat` 为 `tiptap-json`。
- 普通笔记可使用加粗、标题、列表等工具栏按钮，并自动保存。
- 普通笔记可设置字号和行距；切换笔记或重启后 TipTap JSON 中的字号、行距保留。
- 重启或重新选择笔记后富文本格式保留。
- Markdown 笔记仍使用纯文本编辑，不被保存为 TipTap JSON。
- 旧 `plain-text` 笔记能打开并在编辑保存后升级为 `tiptap-json`。
- 文件树和文件夹卡片摘要显示纯文本预览。

## 开放问题

- 图片粘贴应在附件模块落地后接入。
- 表格是否进入 V1，需要结合真实使用频率再定。
- 导出时是优先生成 Markdown、HTML，还是 JSON 包，需要在导入导出设计中确定。
