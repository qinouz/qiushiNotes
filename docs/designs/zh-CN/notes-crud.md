# 笔记 CRUD

## 状态

草稿

## 背景

笔记 CRUD 是桌面端的第一个完整业务模块。它负责新建、读取、编辑、自动保存和软删除笔记。

这个模块也是学习 Electron 项目的核心入口，因为它会串起完整数据流：

```text
Vue renderer
  -> preload 暴露安全 API
  -> ipcRenderer.invoke(...)
  -> main 进程 ipcMain.handle(...)
  -> note-service
  -> SQLite
```

## 目标

- 能新建笔记。
- 能显示笔记列表。
- 能选择一条笔记并编辑标题、正文。
- 编辑后自动保存到本地 SQLite。
- 删除笔记时使用软删除。
- renderer 不直接访问 SQLite。
- 为后续同步保留 `version`、`sync_status`、`deleted_at` 行为。

## 非目标

- 不实现富文本编辑器，第一版先用普通文本区域验证数据流。
- 不实现多级笔记本选择。
- 不实现标签、收藏、置顶 UI。
- 不实现全文搜索。
- 不实现服务器同步。
- 不实现回收站完整 UI，只先做软删除能力。

## 用户流程

1. 用户打开应用。
2. 应用加载未删除的笔记列表。
3. 如果没有笔记，界面显示空状态。
4. 用户点击新建按钮。
5. main 进程创建一条本地笔记并保存到 SQLite。
6. renderer 重新加载列表，并选中新笔记。
7. 用户编辑标题或正文。
8. renderer 使用防抖自动保存。
9. main 进程更新笔记、更新时间、版本号和同步状态。
10. 用户删除笔记时，记录 `deleted_at`，不物理删除。

## UI 行为

第一版使用三栏界面：

```text
左侧：笔记本占位
中间：笔记列表
右侧：标题输入框 + 正文 textarea
```

列表行为：

- 默认按标题显示名称稳定排序。
- 中文标题按拼音/首字母排序，英文标题按字母排序，数字使用自然排序。
- 置顶笔记仍然排在普通笔记前面；同一组内再按标题排序。
- 自动保存只更新内容和更新时间，不应该因为 `updated_at` 改变而让笔记在列表中跳动。
- 显示标题和正文预览。
- 当前选中的笔记高亮。
- 没有笔记时显示空状态。

编辑行为：

- 标题为空时在列表中显示“未命名笔记”。
- 正文使用普通 textarea。
- 输入后延迟自动保存，避免每个字符都写数据库。
- 保存中和已保存状态可以先放在右上角文字中。

删除行为：

- 点击删除按钮后软删除当前笔记。
- 删除后从当前列表移除。
- 如果还有其他笔记，自动选中最新一条。

## Renderer 组件结构

当前模块拆成这些 renderer 文件：

```text
App.vue
layouts/MainLayout.vue
features/notes/useNotes.ts
features/notes/NoteList.vue
features/notes/NoteEditor.vue
```

职责划分：

- `App.vue`：应用入口，只负责挂载主布局。
- `MainLayout.vue`：负责三栏结构和左侧笔记本占位。
- `useNotes.ts`：负责笔记状态、加载、新建、选择、自动保存和软删除。
- `NoteList.vue`：负责笔记列表、新建按钮、空状态和选中态。
- `NoteEditor.vue`：负责标题、正文、保存状态、删除按钮和错误提示。

设计原因：

- `App.vue` 不应该长期承担业务逻辑，否则后续搜索、笔记本、附件都会堆在同一个文件里。
- `useNotes.ts` 集中管理 renderer 侧业务状态，暂时不引入 Pinia，避免第一版过早复杂化。
- 组件只关心展示和事件，不直接调用 SQLite，也不绕过 preload API。

## 数据模型

使用已有 `notes` 表：

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

第一版约定：

- `id` 使用 UUID。
- `content_format` 固定为 `plain-text`。
- 新笔记标题默认为 `未命名笔记`。
- 新笔记 `sync_status` 为 `local`。
- 更新笔记时 `version = version + 1`。
- 更新笔记时 `sync_status = 'pending'`，表示未来需要同步。
- 删除笔记只写入 `deleted_at`，不执行 `DELETE FROM notes`。

## 本地存储

笔记正文保存在 SQLite `notes.content` 字段。

本模块不处理附件。图片和文件后续由附件模块负责。

## IPC / API 边界

renderer 只能通过 preload 暴露的 `window.qiushi.notes` 调用能力。

preload API：

```ts
window.qiushi.notes.list()
window.qiushi.notes.get(id)
window.qiushi.notes.create(input)
window.qiushi.notes.update(id, patch)
window.qiushi.notes.softDelete(id)
```

IPC 通道：

```text
notes:list
notes:get
notes:create
notes:update
notes:soft-delete
```

main 进程结构：

```text
ipc/notes-ipc.ts
services/note-service.ts
```

设计原因：

- renderer 是页面层，不可信任它直接访问本地数据库。
- preload 是受控桥，只暴露必要 API。
- main service 统一管理数据规则，比如软删除、版本号、同步状态。

## 同步影响

虽然同步还没实现，但本模块要提前遵守同步规则：

- 新建笔记使用 UUID，不依赖服务器 ID。
- 修改笔记增加 `version`。
- 修改后标记 `sync_status = 'pending'`。
- 删除使用 `deleted_at`，未来同步时可以向服务器传递删除状态。
- 不在 renderer 中直接决定同步状态，统一由 main service 维护。

## 异常处理

可能失败的情况：

- 数据库没有初始化。
- 笔记 ID 不存在。
- 更新 patch 为空或字段非法。
- 数据库写入失败。

第一版处理：

- main service 抛出明确错误。
- preload/IPC 把错误传回 renderer。
- renderer 显示简单错误提示。

后续改进：

- IPC 返回统一 `{ ok, data, error }` 结构。
- 增加 toast 或状态栏错误提示。
- 自动保存失败时保留未保存状态并允许重试。

## 隐私与数据安全

- 笔记内容只保存在本地 SQLite。
- 第一版不会上传到服务器。
- 删除是软删除，避免误操作造成不可恢复丢失。
- 未来导出和备份要覆盖所有未物理删除数据。

## Electron 学习点

这个模块需要掌握：

- main 进程负责本地能力。
- renderer 是普通前端页面。
- preload 是安全桥。
- IPC 用于跨进程请求。
- `contextIsolation: true` 下不能直接把 Node API 暴露给页面。
- 数据库操作应该集中在 main，而不是分散在 Vue 组件里。

## 测试计划

- 类型检查通过。
- desktop 构建通过。
- 应用启动后能创建笔记。
- 关闭并重新打开后，笔记仍然存在。
- 修改标题和正文后，列表和编辑器显示一致。
- 修改正文并自动保存后，笔记不因为更新时间变化跳到列表顶部。
- 修改标题后，笔记按新的标题排序位置显示。
- 删除笔记后，列表不再显示。
- SQLite 中记录仍存在，只是 `deleted_at` 不为空。

## 待确认问题

- 自动保存延迟先用 600ms 还是 1000ms？
- 第一版是否需要手动保存按钮？
- 删除是否需要确认弹窗？
- 是否在列表中展示更新时间？

## 后续改进

- 替换 textarea 为 TipTap 富文本编辑器。
- 增加回收站页面。
- 增加置顶、收藏、标签。
- 增加搜索和正文摘要生成。
- 增加“最近编辑”“标题排序”等列表排序模式，让用户主动选择。
- 自动保存失败时增加重试队列。
