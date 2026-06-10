import { app, BrowserWindow } from 'electron'
import { closeDatabase, initializeDatabase } from './db/database'
import { registerNotebooksIpcHandlers } from './ipc/notebooks-ipc'
import { registerNotesIpcHandlers } from './ipc/notes-ipc'
import { ensureDefaultNotebook } from './services/notebook-service'
import { createMainWindow } from './window'

// 这个名字会影响窗口标题以外的一些系统路径，例如 app.getPath('userData')。
// 尽早设置，避免真实数据目录落到 package 名 `desktop` 下。
app.setName('秋实笔记')

app.whenReady().then(() => {
  // 数据库必须先于窗口初始化。
  // 后续 renderer 一启动就可能通过 preload 调用笔记 API，如果这里延后，
  // 很容易出现 UI 已经加载但本地数据层还没准备好的竞态。
  const { paths } = initializeDatabase()
  console.info(`Local database initialized at ${paths.databasePath}`)

  ensureDefaultNotebook()
  registerNotebooksIpcHandlers()
  registerNotesIpcHandlers()

  // 给自动化验证留一个无窗口启动模式。
  // 只在显式设置环境变量时启用，日常运行不会走这里。
  if (process.env.QIUSHI_HEADLESS_SMOKE === '1') {
    app.quit()
    return
  }

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // 显式关闭数据库连接，避免应用退出时还有 WAL/锁文件处在不确定状态。
  // 后续做备份和自动更新时，这个边界会更重要。
  closeDatabase()
})
