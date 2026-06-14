# 2026-06-14 本地优先笔记开发交接

## 当前方向

第一版继续按“本地优先 Windows 桌面笔记”推进。服务端、微信登录、账号体系、同步和官网备案相关工作先不进入当前实现主线；本地 SQLite、离线编辑、导出、备份和可恢复性仍然是第一优先级。

有道云笔记只作为常见工作流参考，不做完整克隆。本轮围绕基础笔记能力、搜索、回收站、导入导出入口、表格笔记和调试能力补齐。

## 今天完成的主要内容

- 补了全文搜索服务和 IPC，左侧搜索框可以查普通富文本、Markdown、纯文本和表格笔记里的单元格文本。
- 补了回收站视图，删除仍然走软删除，支持从回收站恢复，避免误删后物理丢失。
- 补了本地导出入口和相关服务，导出仍以本地 JSON 和附件可迁移为方向。
- 扩展笔记内容类型，新增 `spreadsheet-json`，用于表格笔记。
- 引入 Univer Sheets Core Preset，表格笔记使用第三方表格引擎承接基础 Excel 类交互。
- 表格笔记默认生成日报模板，列为：日期、任务项、优先级、状态、备注。
- 表格笔记进入笔记树、文件夹内容视图、搜索结果和编辑器标题栏，使用表格图标和“表格”类型标识。
- 表格内容保存为 `notes.content` 内的 Univer workbook 快照，搜索索引从 workbook 单元格中提取文本。
- 表格打开时兼容旧的手工 workbook 快照，并迁移为 Facade `workbook.save()` 快照格式。
- 搜索框原生清除按钮加大，便于鼠标点击。
- 开发调试能力增强：开发模式自动打开 DevTools，并把 renderer console、CSP、加载失败、renderer 崩溃等日志转发到启动终端。

## 表格白屏问题定位

用户反馈“表格啥也没有 / 还是白屏”后，用 Electron remote debugging 连接真实数据复现。

关键证据：

- 表格编辑器 DOM 已挂载。
- Univer 主 canvas 尺寸正常，不是容器 0 高度问题。
- CSP 报错拦截了 `data:image/svg+xml;base64,...`。
- Univer 在 `createPattern` 阶段抛异常，导致 canvas 内容全透明。

修复：

- `apps/desktop/src/renderer/index.html` 的 CSP 增加 `img-src 'self' data: qiushi-attachment:`。
- 只放行图片 `data:`，脚本仍然限制为本地 `'self'`。
- `docs/designs/zh-CN/spreadsheet-note.md` 已记录这个约束。

复测：

- 修复前主 canvas 采样区域全透明。
- 修复后同一区域出现非透明和非白像素，不再有 `createPattern` 异常，也没有 `data:image` CSP 报错。

## 表格保存 smoke 已补

本轮继续补了表格保存链路的自动化 smoke，目标是把“表格能写进本地 SQLite、切换回来仍可见、搜索能搜到”变成可重复验证，而不是只靠手动点几下。

新增内容：

- 新增 `scripts/spreadsheet-smoke.mjs`，会启动 Electron 构建产物，并通过 `--remote-debugging-port` 连接 renderer。
- 新增 `pnpm.cmd --filter desktop smoke:spreadsheet` 和根目录 `pnpm.cmd smoke:spreadsheet` 脚本。
- smoke 使用仓库 `.tmp/spreadsheet-smoke-user-data` 作为隔离 `QIUSHI_USER_DATA_DIR`，不写真实用户数据。
- 新增 `QIUSHI_SKIP_LEGACY_MIGRATION=1`，避免自动化时把旧中文 userData 目录拷贝进测试目录。
- 表格组件只在 `QIUSHI_SMOKE=1` 时暴露 `window.__qiushiSpreadsheetSmoke` 最小测试钩子。
- smoke 钩子只写当前 Univer workbook，然后仍走 `update:content -> notes:update -> SQLite/search index` 的真实保存链路。
- `.tmp/` 已加入 `.gitignore`，避免测试数据库、附件或导出文件误提交。

smoke 覆盖：

- 创建一条 `spreadsheet-json` 表格笔记。
- 向单元格写入唯一 marker。
- 等待外层自动保存状态回到“已保存”。
- 查询 SQLite 中该笔记正文，确认 marker 已进入 `notes.content`。
- 创建另一条普通笔记并刷新/切换，再切回表格笔记，确认 marker 仍在表格快照中。
- 在左侧搜索框搜索 marker，确认搜索结果命中该表格笔记。

运行时观察到的非阻断警告：

- Electron 提示 `console-message` 旧参数签名后续会移除，当前来自 `window.ts` 里的 renderer 日志转发。
- TipTap 提示 `link`、`underline` extension name 重复，当前不影响本轮 smoke，但后续可以单独清理。

## 调试方式

开发时直接运行：

```powershell
pnpm.cmd --filter desktop dev
```

开发模式下会自动打开 DevTools。CSP 和浏览器层错误看 DevTools Console，同时也会转发到启动终端，格式类似：

```text
[renderer:error] Refused to load the image ... because it violates the following Content Security Policy directive ...
[renderer:load-failed] main-frame ...
[renderer:process-gone] reason=crashed exitCode=...
```

如果不想自动打开 DevTools：

```powershell
$env:QIUSHI_OPEN_DEVTOOLS='0'
pnpm.cmd --filter desktop dev
```

如果需要在非开发模式也转发 renderer 日志：

```powershell
$env:QIUSHI_RENDERER_LOGS='1'
pnpm.cmd --filter desktop preview
```

调试或自动化验证需要隔离真实用户数据时，可以设置：

```powershell
$env:QIUSHI_USER_DATA_DIR='E:\myproject\qiushiNotes\.tmp\electron-debug-user-data'
```

如果是自动化 smoke，还会额外设置：

```powershell
$env:QIUSHI_SMOKE='1'
$env:QIUSHI_SKIP_LEGACY_MIGRATION='1'
```

## 已验证命令

```powershell
pnpm.cmd -r typecheck
pnpm.cmd --filter desktop typecheck
pnpm.cmd --filter desktop build
pnpm.cmd --filter desktop smoke:spreadsheet
git diff --check
```

构建仍会出现第三方 React/Radix 包的 `"use client"` bundle 警告，这是 Vite 打包依赖时的已知警告，本轮没有发现它影响 Electron 运行。

## 后续建议

- 继续完善表格笔记的真实编辑体验：单元格输入、复制粘贴、行列增删、列宽行高拖拽保存。
- 在现有表格 smoke 基础上继续扩展真实编辑覆盖，尤其是复制粘贴、行列增删、列宽行高拖拽保存。
- 表格功能稳定后，再考虑 `.xlsx` 导入导出；当前用户明确说暂不需要。
- 检查 Univer bundle 体积，当前 renderer 主包较大，后续可以研究代码分割或按需加载表格编辑器。
- 继续补齐本地导入、导出、备份恢复和回收站的异常路径测试。
- 统一处理当前仓库里部分中文注释或字符串显示乱码的问题，避免未来维护者误判含义。
- 账号登录、微信登录、官网备案和服务端同步继续延后，等本地桌面版稳定后再开新 PRD / 设计文档。

## 注意事项

- 不要为了同步或账号体系改成本地功能依赖服务端。
- 所有笔记、附件、表格快照仍应先写入本地 SQLite / 本地附件目录。
- 删除继续保持软删除，恢复能力优先于物理清理。
- 表格快照是用户数据，迁移和保存失败时不要覆盖原始内容。
- 本项目使用 pnpm，`package-lock.json` 不应提交。
