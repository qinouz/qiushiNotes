# 2026-06-11 晚间开发交接

## 当前状态

本次提交把桌面端主界面从旧的“左侧笔记本 + 中间笔记列表 + 右侧编辑器”调整为更接近有道云笔记的工作区：

```text
左侧窄功能栏
  -> 中间搜索 / 新建 / 文件树
      -> 右侧编辑器
```

核心方向是：左侧只保留稳定功能入口，中间模块直接承担笔记本和笔记的文件树组织，右侧尽量给编辑区留空间。

## 已完成

- 新增窄功能栏 `FunctionBar.vue`，当前只开放“笔记”，收藏、标签、回收站、设置等入口先禁用。
- 新增中间栏 `MiddlePane.vue`，包含搜索框、新建按钮和文件树。
- 新增统一文件树 `NoteTree.vue`，同时展示笔记本和笔记。
- 新增 `useNoteTree.ts` 作为当前主界面的 renderer 状态源，统一管理：
  - 笔记本列表。
  - 笔记列表。
  - 文件夹展开/折叠。
  - 当前选中节点。
  - 当前选中文件夹。
  - 新建笔记和新建文件夹。
  - 重命名文件夹。
  - 自动保存。
- 新增笔记本创建和重命名的 main / preload / IPC 链路。
- 新增 `@lucide/vue`，替换主界面里的临时 emoji 图标。
- 更新 `docs/designs/zh-CN/ui-shell.md` 和 `docs/designs/zh-CN/notebook-tree.md`。

## 当前主路径文件

继续开发 UI 时，优先看这些文件：

```text
apps/desktop/src/renderer/layouts/MainLayout.vue
apps/desktop/src/renderer/layouts/FunctionBar.vue
apps/desktop/src/renderer/layouts/MiddlePane.vue
apps/desktop/src/renderer/features/notebooks/NoteTree.vue
apps/desktop/src/renderer/features/notebooks/useNoteTree.ts
apps/desktop/src/renderer/components/DropdownMenu.vue
apps/desktop/src/renderer/features/notes/NoteEditor.vue
apps/desktop/src/renderer/styles/global.css
```

笔记本写入能力在这些文件：

```text
packages/shared/src/index.ts
apps/desktop/src/main/services/notebook-service.ts
apps/desktop/src/main/ipc/notebooks-ipc.ts
apps/desktop/src/preload/api.ts
apps/desktop/src/preload/index.ts
```

## 运行和验证

当前 Windows 开发环境需要 Node 24：

```powershell
nvm use 24.13.1
node -v
pnpm --version
```

本次已验证通过：

```powershell
pnpm typecheck
pnpm build
```

本地开发启动：

```powershell
pnpm dev
```

## 继续开发建议

下一步建议先补“笔记移动到指定文件夹”，因为现在中间栏已经是文件树，缺少移动能力会让整理资料的体验不完整。

建议顺序：

1. 更新 `docs/designs/zh-CN/notebook-tree.md`，补“移动笔记”的用户流程、IPC/API、错误处理和测试计划。
2. 在 `note-service.ts` 里复用现有 `updateNote(id, { notebookId })` 能力，确认目标笔记本必须存在且未删除。
3. 在 `NoteTree.vue` 或编辑器区域提供移动入口。
4. 运行 `pnpm typecheck` 和 `pnpm build`。

## 注意事项

- 不要从 PowerShell 乱码输出里复制中文回源码；需要用 Node 按 UTF-8 读文件确认。
- 搜索框当前只是过滤已加载的树节点，不是 SQLite FTS 全文搜索。
- 当前没有实现笔记本删除；删除策略必须等回收站/恢复设计更完整后再做。
- 如果工作区里看到未接入的 `NotebookTree.vue` 或 `NotebookNoteList.vue`，它们是下午文件树实验稿，不是当前主路径。继续开发时优先沿用 `NoteTree.vue` 和 `useNoteTree.ts`。
