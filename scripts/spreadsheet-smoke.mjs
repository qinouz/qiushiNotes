import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const desktopRoot = path.join(repoRoot, 'apps', 'desktop')
const appMain = path.join(desktopRoot, 'dist', 'main', 'index.js')
const desktopRequire = createRequire(path.join(desktopRoot, 'package.json'))
const electronBinary = desktopRequire('electron')
const tmpRoot = path.join(repoRoot, '.tmp')
const userDataDir = path.join(tmpRoot, 'spreadsheet-smoke-user-data')
const SMOKE_TIMEOUT_MS = 45_000

if (!existsSync(appMain)) {
  throw new Error('缺少桌面端构建产物。请先运行 pnpm.cmd --filter desktop build。')
}

if (!existsSync(electronBinary)) {
  throw new Error('缺少 Electron 可执行文件。请先运行 pnpm.cmd install。')
}

async function main() {
  await resetSmokeUserData()

  const debugPort = await findFreePort()
  const electron = spawn(
    electronBinary,
    [`--remote-debugging-port=${debugPort}`, appMain],
    {
      cwd: desktopRoot,
      env: {
        ...process.env,
        QIUSHI_OPEN_DEVTOOLS: '0',
        QIUSHI_RENDERER_LOGS: '1',
        QIUSHI_SMOKE: '1',
        QIUSHI_SKIP_LEGACY_MIGRATION: '1',
        QIUSHI_USER_DATA_DIR: userDataDir
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )

  let childOutput = ''
  electron.stdout.on('data', (chunk) => {
    const text = chunk.toString()
    childOutput += text
    process.stdout.write(text)
  })
  electron.stderr.on('data', (chunk) => {
    const text = chunk.toString()
    childOutput += text
    process.stderr.write(text)
  })

  let exited = false
  electron.once('exit', (code, signal) => {
    exited = true
    if (code !== 0 && code !== null) {
      childOutput += `\nElectron exited with code ${code}.\n`
    } else if (signal) {
      childOutput += `\nElectron exited with signal ${signal}.\n`
    }
  })

  let cdp = null

  try {
    const target = await waitForTarget(debugPort)
    cdp = await CdpClient.connect(target.webSocketDebuggerUrl)
    await cdp.send('Runtime.enable')
    await cdp.send('Page.enable')

    await waitForPage(cdp)

    const marker = `表格-smoke-${Date.now()}`
    const spreadsheetTitle = `Smoke 表格 ${marker}`
    const otherTitle = `000 Smoke 普通笔记 ${marker}`

    const noteId = await evaluate(cdp, `
      (async () => {
        const note = await window.qiushi.notes.create({
          title: ${json(spreadsheetTitle)},
          contentFormat: 'spreadsheet-json'
        })
        window.location.reload()
        return note.id
      })()
    `)

    await waitForPage(cdp)
    await waitFor(
      () => evaluate(cdp, `window.__qiushiSpreadsheetSmoke?.noteId === ${json(noteId)}`),
      '表格编辑器没有挂载 smoke 钩子'
    )

    await evaluate(cdp, `
      window.__qiushiSpreadsheetSmoke.setCellValue(1, 1, ${json(marker)})
    `)

    await waitFor(
      () => evaluate(cdp, `
        (async () => {
          const note = await window.qiushi.notes.get(${json(noteId)})
          const status = document.querySelector('.save-status')?.textContent ?? ''
          return Boolean(note?.content.includes(${json(marker)}) && status.includes('已保存'))
        })()
      `),
      '表格单元格内容没有进入 SQLite 自动保存链路'
    )

    await evaluate(cdp, `
      (async () => {
        await window.qiushi.notes.create({
          title: ${json(otherTitle)},
          contentFormat: 'tiptap-json'
        })
        window.location.reload()
      })()
    `)

    await waitForPage(cdp)
    await waitFor(
      () => evaluate(cdp, `
        (document.querySelector('.note-format-badge')?.textContent ?? '').includes('富文本')
      `),
      '切换用普通笔记没有成为当前笔记'
    )

    await evaluate(cdp, `
      (() => {
        const buttons = Array.from(document.querySelectorAll('.tree-node-button'))
        const target = buttons.find((button) => button.textContent?.includes(${json(spreadsheetTitle)}))

        if (!target) {
          throw new Error('没有在笔记树中找到 smoke 表格笔记。')
        }

        target.click()
      })()
    `)

    await waitFor(
      () => evaluate(cdp, `window.__qiushiSpreadsheetSmoke?.noteId === ${json(noteId)}`),
      '切回表格笔记后编辑器没有重新挂载'
    )
    await waitFor(
      () => evaluate(cdp, `
        window.__qiushiSpreadsheetSmoke.getSerializedContent().includes(${json(marker)})
      `),
      '切回表格笔记后单元格内容不可见'
    )

    await evaluate(cdp, `
      (() => {
        const input = document.querySelector('.search-input')

        if (!input) {
          throw new Error('没有找到搜索框。')
        }

        input.value = ${json(marker)}
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })()
    `)

    await waitFor(
      () => evaluate(cdp, `
        Array.from(document.querySelectorAll('.search-result-item'))
          .some((item) => item.textContent?.includes(${json(spreadsheetTitle)}))
      `),
      '搜索没有命中表格单元格文字'
    )

    console.info('Spreadsheet smoke passed.')
  } catch (error) {
    const details = childOutput.trim() ? `\n\nElectron output:\n${childOutput.trim()}` : ''
    throw new Error(`${error instanceof Error ? error.message : String(error)}${details}`)
  } finally {
    cdp?.close()

    if (!exited) {
      electron.kill()
    }
  }
}

async function resetSmokeUserData() {
  const resolvedTmpRoot = path.resolve(tmpRoot)
  const resolvedUserDataDir = path.resolve(userDataDir)

  if (!resolvedUserDataDir.startsWith(`${resolvedTmpRoot}${path.sep}`)) {
    throw new Error(`拒绝清理非 .tmp 目录：${resolvedUserDataDir}`)
  }

  await mkdir(resolvedTmpRoot, { recursive: true })
  await rm(resolvedUserDataDir, { recursive: true, force: true })
  await mkdir(resolvedUserDataDir, { recursive: true })
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : null

      server.close(() => {
        port ? resolve(port) : reject(new Error('无法分配本地调试端口。'))
      })
    })
  })
}

async function waitForTarget(port) {
  return waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`)

    if (!response.ok) {
      return null
    }

    const targets = await response.json()

    return targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl) ?? null
  }, '没有找到 Electron renderer 调试目标')
}

async function waitForPage(client) {
  await waitFor(
    () => evaluate(client, `
      document.readyState === 'complete' &&
      Boolean(window.qiushi?.notes && document.querySelector('.app-shell'))
    `),
    '页面没有完成加载'
  )
}

async function waitFor(check, message, timeoutMs = SMOKE_TIMEOUT_MS) {
  const startedAt = Date.now()
  let lastError = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await check()

      if (result) {
        return result
      }
    } catch (error) {
      lastError = error
    }

    await delay(250)
  }

  throw new Error(`${message}${lastError ? `：${lastError.message}` : ''}`)
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  })

  if (response.exceptionDetails) {
    const exception = response.exceptionDetails.exception?.description
      ?? response.exceptionDetails.text
      ?? 'renderer evaluation failed'
    throw new Error(exception)
  }

  return response.result.value
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function json(value) {
  return JSON.stringify(value)
}

class CdpClient {
  static connect(url) {
    const client = new CdpClient(url)
    return client.open()
  }

  constructor(url) {
    this.url = url
    this.nextId = 1
    this.pending = new Map()
    this.socket = null
  }

  open() {
    this.socket = new WebSocket(this.url)

    return new Promise((resolve, reject) => {
      this.socket.addEventListener('open', () => resolve(this))
      this.socket.addEventListener('error', () => reject(new Error('无法连接 Chrome DevTools Protocol。')), {
        once: true
      })
      this.socket.addEventListener('message', (event) => this.handleMessage(event.data))
      this.socket.addEventListener('close', () => {
        for (const { reject: rejectPending } of this.pending.values()) {
          rejectPending(new Error('Chrome DevTools Protocol 连接已关闭。'))
        }

        this.pending.clear()
      })
    })
  }

  send(method, params = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Chrome DevTools Protocol 尚未连接。'))
    }

    const id = this.nextId
    this.nextId += 1

    const message = JSON.stringify({ id, method, params })

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(message)
    })
  }

  handleMessage(data) {
    const text = typeof data === 'string' ? data : Buffer.from(data).toString('utf8')
    const message = JSON.parse(text)

    if (!message.id) {
      return
    }

    const pending = this.pending.get(message.id)

    if (!pending) {
      return
    }

    this.pending.delete(message.id)

    if (message.error) {
      pending.reject(new Error(message.error.message))
    } else {
      pending.resolve(message.result)
    }
  }

  close() {
    this.socket?.close()
  }
}

await main()
