# 笔记本列表

## 状态

草稿

## 背景

当前左侧笔记本区域还是静态占位。为了让本地数据库真正承载笔记组织能力，需要先把 `notebooks` 表接入界面。

第一版只做最小可用的笔记本列表：

- 应用启动时确保存在一个“默认笔记本”。
- 左侧从 SQLite 读取笔记本。
- 点击笔记本后，中间笔记列表按笔记本过滤。
- 新建笔记时，优先放入当前选中的笔记本；如果当前是“全部笔记”，则放入默认笔记本。

## 目标

- main 进程提供笔记本读取能力。
- preload 暴露 `window.qiushi.notebooks`。
- renderer 左侧显示真实笔记本列表。
- 笔记列表支持按笔记本过滤。
- 新建笔记有默认笔记本归属。

## 非目标

- 不实现多级树展开/折叠。
- 不实现新建、重命名、删除笔记本 UI。
- 不实现拖拽排序。
- 不实现笔记移动功能。
- 不实现回收站完整页面。

## 用户流程

1. 用户启动应用。
2. main 进程初始化数据库。
3. main 进程确保至少存在一个“默认笔记本”。
4. renderer 读取笔记本列表。
5. 左侧显示“全部笔记”和真实笔记本。
6. 用户点击某个笔记本。
7. 中间笔记列表只显示该笔记本下未删除的笔记。
8. 用户点击新建笔记。
9. 如果当前选中具体笔记本，新笔记进入该笔记本。
10. 如果当前选中“全部笔记”，新笔记进入默认笔记本。

## UI 行为

左侧当前结构：

```text
应用名
全部笔记
默认笔记本
回收站（占位）
```

第一版改成：

```text
应用名
全部笔记
笔记本
  默认笔记本
回收站（占位）
```

选中态：

- `全部笔记` 选中时显示所有未删除笔记。
- 具体笔记本选中时显示该笔记本内笔记。

## 数据模型

使用已有 `notebooks` 表：

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

第一版约定：

- `id` 使用 UUID。
- 默认笔记本名称为 `默认笔记本`。
- `parent_id` 暂时为 `NULL`。
- `sort_order` 暂时为 `0`。
- 删除仍然使用 `deleted_at`，但第一版不暴露删除 UI。

## IPC / API 边界

preload API：

```ts
window.qiushi.notebooks.list()
window.qiushi.notebooks.ensureDefault()
```

IPC 通道：

```text
notebooks:list
notebooks:ensure-default
```

main 进程结构：

```text
services/notebook-service.ts
ipc/notebooks-ipc.ts
```

notes API 调整：

```ts
window.qiushi.notes.list({ notebookId })
window.qiushi.notes.create({ notebookId })
```

## 同步影响

笔记本也是未来同步对象，所以：

- 使用 UUID。
- 保留 `version`。
- 保留 `sync_status`。
- 删除使用 `deleted_at`。
- 默认笔记本在本地创建，未来同步时按普通笔记本同步。

## 异常处理

可能失败的情况：

- 默认笔记本创建失败。
- 笔记本列表读取失败。
- 选中的笔记本被删除。
- 新建笔记时默认笔记本不存在。

第一版处理：

- 启动时确保默认笔记本。
- renderer 加载失败时显示错误信息。
- 如果没有选中具体笔记本，新建笔记时使用默认笔记本。

## Electron 学习点

这个模块会再次练习完整数据流：

```text
NotebookSidebar
  -> useNotebooks
  -> preload notebooks API
  -> notebooks IPC
  -> notebook-service
  -> SQLite
```

它和 notes 模块一样，renderer 不直接访问数据库。

## 测试计划

- 类型检查通过。
- desktop 构建通过。
- 无窗口启动能创建默认笔记本。
- 左侧能显示真实笔记本。
- 点击笔记本能过滤笔记列表。
- 新建笔记能写入当前笔记本或默认笔记本。

## 后续改进

- 新建笔记本。
- 重命名笔记本。
- 删除笔记本。
- 多级树。
- 拖拽排序。
- 笔记移动。

