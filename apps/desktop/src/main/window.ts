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
  const isDevelopment = Boolean(process.env.ELECTRON_RENDERER_URL)

  registerRendererDiagnostics(window, isDevelopment || process.env.QIUSHI_RENDERER_LOGS === '1')

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

  if (isDevelopment && process.env.QIUSHI_OPEN_DEVTOOLS !== '0') {
    window.webContents.once('did-finish-load', () => {
      // 开发期默认打开 DevTools，CSP、资源加载、Vue 运行时异常都会先出现在 Console。
      // 如果窗口太吵，可以用 QIUSHI_OPEN_DEVTOOLS=0 关闭自动弹出。
      window.webContents.openDevTools({ mode: 'detach' })
    })
  }

  return window
}

function registerRendererDiagnostics(window: BrowserWindow, enabled: boolean): void {
  if (!enabled) {
    return
  }

  const { webContents } = window

  // Electron 的 renderer console 事件会带出 CSP、资源加载、未捕获异常等浏览器层日志。
  // 转发到启动终端后，即使 DevTools 没开，也能看到关键错误。
  webContents.on('console-message', (details, legacyLevel, legacyMessage, legacyLine, legacySourceId) => {
    const detailRecord = details as unknown as Partial<{
      level: string
      message: string
      lineNumber: number
      sourceId: string
    }>
    const level = detailRecord.level ?? toLegacyConsoleLevel(legacyLevel)
    const message = detailRecord.message ?? legacyMessage
    const sourceId = detailRecord.sourceId ?? legacySourceId
    const lineNumber = detailRecord.lineNumber ?? legacyLine
    const sourceSuffix = sourceId ? ` (${sourceId}${lineNumber ? `:${lineNumber}` : ''})` : ''
    const output = `[renderer:${level}] ${message}${sourceSuffix}`

    if (level === 'error') {
      console.error(output)
    } else if (level === 'warning') {
      console.warn(output)
    } else {
      console.info(output)
    }
  })

  webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    const frame = isMainFrame ? 'main-frame' : 'sub-frame'
    console.error(`[renderer:load-failed] ${frame} ${errorCode} ${errorDescription} ${validatedURL}`)
  })

  webContents.on('render-process-gone', (_event, details) => {
    console.error(`[renderer:process-gone] reason=${details.reason} exitCode=${details.exitCode}`)
  })

  webContents.on('unresponsive', () => {
    console.warn('[renderer:unresponsive] renderer page stopped responding')
  })

  webContents.on('responsive', () => {
    console.info('[renderer:responsive] renderer page became responsive again')
  })
}

function toLegacyConsoleLevel(level: number): string {
  return ['debug', 'info', 'warning', 'error'][level] ?? 'info'
}
