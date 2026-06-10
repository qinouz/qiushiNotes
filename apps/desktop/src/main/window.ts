import { BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: '秋实笔记',
    webPreferences: {
      // electron-vite 的 preload 产物是 ESM，所以生产构建中这里指向 index.mjs。
      // preload 是 renderer 访问本地能力的唯一桥，不能把 Node 能力直接交给页面。
      preload: path.join(dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    // 外部链接交给系统浏览器打开，避免第三方页面进入应用窗口上下文。
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    // 开发模式下 electron-vite 会注入本地 dev server 地址。
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    // 生产模式加载已经构建好的 renderer 静态文件。
    void window.loadFile(path.join(dirname, '../renderer/index.html'))
  }

  return window
}
