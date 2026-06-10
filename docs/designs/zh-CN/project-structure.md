# 项目基础结构

## 状态

草稿

## 背景

项目第一阶段只做 Windows 桌面笔记应用，但目录结构要给后续服务器、共享类型、私人知识库和移动端留下空间。

结构不能一开始就过度复杂，也不能简单到后面加同步和服务器时大拆。

## 目标

- 第一阶段聚焦桌面端。
- 使用轻量 monorepo。
- 清晰分离 Electron main、preload、renderer。
- SQLite 和文件系统访问只放在 main 进程。
- 给未来 server 和 shared package 留位置。
- 让设计文档成为功能开发入口。

## 非目标

- 第一阶段不实现服务器。
- 暂不创建移动端目录。
- 暂不设计插件系统。
- 暂不引入复杂发布流水线。

## 推荐目录

```text
qiushiNotes/
  AGENTS.md
  家庭服务器与私人云笔记计划书.md
  云笔记项目开发规则.md

  docs/
    designs/
      zh-CN/
        README.md
        template.md
        community-reference.md
        project-structure.md
        local-database.md

  apps/
    desktop/
      package.json
      electron.vite.config.ts
      src/
        main/
          index.ts
          window.ts
          ipc/
          db/
            migrations/
          services/
          filesystem/
        preload/
          index.ts
          api.ts
        renderer/
          index.html
          main.ts
          App.vue
          styles/
          components/
          layouts/
          features/
            notes/
            notebooks/
              NotebookSidebar.vue
            editor/
            search/
            attachments/
            trash/
          stores/
          composables/
          api/
      resources/
        icons/

    server/
      README.md

  packages/
    shared/
      package.json
      src/
        types/
        schemas/
        constants/

  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

## 工具版本

```text
Node.js >= 22.13.0
pnpm 11.5.3
Electron 41.7.2
TypeScript 5.9.3
```

国内网络环境使用项目级 `.npmrc`：

```text
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
```

## 包管理

使用 `pnpm workspace`。

原因：

- monorepo 支持好。
- 依赖安装效率高。
- 以后加 server、shared、mobile 时容易拆分。
- 根目录脚本可以统一调度各 workspace。

根目录脚本示例：

```json
{
  "scripts": {
    "dev": "pnpm --filter desktop dev",
    "build": "pnpm --filter desktop build",
    "typecheck": "pnpm -r typecheck"
  }
}
```

## Electron 分层

### Main 进程

目录：

```text
apps/desktop/src/main/
```

职责：

- 创建窗口。
- 管理应用生命周期。
- 初始化 SQLite。
- 执行数据库迁移。
- 读写本地文件。
- 保存附件。
- 执行备份和导出。
- 注册 IPC。
- 后续运行后台同步。

main 是唯一能直接访问 SQLite 和文件系统的层。

### Preload

目录：

```text
apps/desktop/src/preload/
```

职责：

- 给 renderer 暴露受控 API。
- 隐藏原始 IPC 通道名。
- 不暴露 Node.js 原始能力。
- 作为 UI 和 main 的安全边界。

示例：

```ts
window.qiushi.notes.create(input)
window.qiushi.notes.update(id, patch)
window.qiushi.notebooks.list()
window.qiushi.attachments.saveFromPaste(input)
window.qiushi.search.query(input)
```

### Renderer

目录：

```text
apps/desktop/src/renderer/
```

职责：

- Vue 应用。
- 页面布局和组件。
- 功能 UI。
- UI 状态管理。
- TipTap 编辑器集成。
- 通过 preload API 调用数据能力。

renderer 不允许直接访问 SQLite、本地文件或不受控的 Node.js API。

## 功能目录

renderer 功能目录：

```text
features/
  notes/
  notebooks/
  editor/
  search/
  attachments/
  trash/
```

main 服务目录：

```text
services/
  note-service.ts
  notebook-service.ts
  attachment-service.ts
  search-service.ts
  backup-service.ts
```

IPC 目录：

```text
ipc/
  notes-ipc.ts
  notebooks-ipc.ts
  attachments-ipc.ts
  search-ipc.ts
```

## 运行时数据目录

真实用户数据不能放在仓库里。

统一使用：

```ts
app.getPath('userData')
```

运行时目录：

```text
C:\Users\<用户名>\AppData\Roaming\QiushiNotes\
  notes.db
  attachments/
  backups/
  exports/
```

所有路径使用 `path.join(...)`。

UI 可以显示中文名称，但内部数据目录使用 ASCII 名 `QiushiNotes`，避免 Windows 终端和脚本工具出现中文路径乱码。

## Shared 包

目录：

```text
packages/shared/
```

用途：

- 共享 TypeScript 类型。
- 共享常量。
- 共享校验 schema。
- 同步状态枚举。
- DTO 定义。

shared 包不能放 Electron 专属代码。

## Server 占位

目录：

```text
apps/server/
```

服务器等本地桌面端稳定后再做。

后续职责：

- 登录认证。
- 同步 API。
- PostgreSQL。
- 附件上传下载。
- 备份任务。
- 知识库索引。

## 设计文档规则

实现功能模块前，先在这里写设计文档：

```text
docs/designs/zh-CN/
```

这个项目基础结构由本文档定义。

## 错误处理

结构上要让错误边界清楚：

- 数据库错误在 main 服务层处理。
- 文件系统错误在 filesystem 或 attachment 服务中处理。
- IPC 返回明确的成功或失败结果。
- renderer 只负责展示用户能理解的错误和重试入口。

## 隐私与数据安全

- 笔记和附件默认只保存在本地。
- 第一版不依赖云端。
- 备份和导出目录明确。
- 后续 AI 或同步不能破坏本地优先原则。

## 测试计划

- 根目录能安装依赖。
- 根目录能启动桌面端开发模式。
- workspace 能统一类型检查。
- renderer 不能直接导入 main 的数据库模块。
- 运行时数据必须创建在 `app.getPath('userData')` 下。

## 待确认问题

- shared 包是否从一开始引入 Zod 做运行时校验？
- 数据库迁移放在 `src/main/db/migrations/` 是否长期合适？
- IPC API 返回 `{ ok, data, error }` 还是抛类型化错误？
