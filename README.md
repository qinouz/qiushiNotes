# 秋实笔记

秋实笔记是一款本地优先的私人云笔记项目。

项目目标不是一开始完整复刻有道云笔记，而是先做出一个稳定、离线可用、数据可控、后续可同步到家庭服务器的桌面笔记应用。

## 核心原则

- 本地优先，离线可用。
- Windows 桌面端优先。
- SQLite 是本地事实来源。
- 服务器只负责后续同步、备份、设备恢复和知识库能力。
- 所有数据必须支持导出和迁移。
- 功能模块开发前先写中文设计文档。

## 当前进度

已完成：

- Electron + Vue 3 + TypeScript 项目骨架。
- pnpm workspace monorepo。
- SQLite 本地数据库初始化。
- 数据库迁移机制。
- notes / notebooks 基础表。
- 笔记新建、列表、选择、编辑、自动保存、软删除。
- 默认笔记本初始化。
- 左侧真实笔记本列表。
- 按笔记本过滤笔记。
- renderer / preload / main / SQLite 完整数据链路。

暂未完成：

- 富文本编辑器 TipTap。
- 图片粘贴和附件。
- 全文搜索。
- 回收站完整页面。
- 数据导入导出。
- 本地备份。
- 服务器同步。
- 移动端。

## 技术栈

桌面端：

- Electron `41.7.2`
- Vue 3
- TypeScript `5.9.3`
- Vite / electron-vite
- SQLite

工程：

- Node.js `>= 22.13.0`
- pnpm `11.5.3`
- pnpm workspace

## 本地运行

先确保 Node 版本：

```powershell
nvm use 22.13.0
```

安装依赖：

```powershell
pnpm.cmd install
```

启动开发模式：

```powershell
pnpm.cmd dev
```

类型检查：

```powershell
pnpm.cmd typecheck
```

构建桌面端：

```powershell
pnpm.cmd --filter desktop build
```

Windows PowerShell 可能会拦截 `pnpm.ps1`，所以本项目文档里优先使用 `pnpm.cmd`。

## 本地数据目录

运行时数据不保存在仓库中，而是保存在 Electron 的用户数据目录：

```text
C:\Users\<用户名>\AppData\Roaming\QiushiNotes\
  notes.db
  attachments/
  backups/
  exports/
```

## 项目结构

```text
qiushiNotes/
  apps/
    desktop/
      src/
        main/       Electron main 进程，负责窗口、SQLite、文件系统、IPC
        preload/    renderer 和 main 之间的安全桥
        renderer/   Vue 页面和组件
    server/         后续服务器占位

  packages/
    shared/         共享类型和常量

  docs/
    designs/
      zh-CN/        中文功能设计文档
```

## Electron 分层

本项目坚持 renderer 不直接访问 SQLite 和本地文件系统。

标准数据流：

```text
Vue renderer
  -> window.qiushi.*
  -> preload
  -> ipcRenderer.invoke(...)
  -> ipcMain.handle(...)
  -> main service
  -> SQLite / filesystem
```

这样做的原因：

- 保持 Electron 安全边界清晰。
- 让本地数据规则集中在 main 进程。
- 后续同步、备份、导出可以统一接入。
- 初学 Electron 时更容易理解每一层职责。

## 设计文档

功能开发前先写中文设计文档，位置：

```text
docs/designs/zh-CN/
```

当前已有：

- `community-reference.md`
- `project-structure.md`
- `local-database.md`
- `notes-crud.md`
- `ui-shell.md`
- `notebook-tree.md`

## GitHub

仓库地址：

https://github.com/qinouz/qiushiNotes.git
