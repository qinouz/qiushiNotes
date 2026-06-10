import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export interface UserDataPaths {
  rootDir: string
  databasePath: string
  attachmentsDir: string
  backupsDir: string
  exportsDir: string
}

export function getUserDataPaths(): UserDataPaths {
  // 真实用户数据必须放在 Electron 管理的 userData 目录，
  // 这样 Windows/macOS 路径差异由 Electron 处理，也避免把笔记写进仓库。
  const rootDir = app.getPath('userData')

  return {
    rootDir,
    databasePath: path.join(rootDir, 'notes.db'),
    attachmentsDir: path.join(rootDir, 'attachments'),
    backupsDir: path.join(rootDir, 'backups'),
    exportsDir: path.join(rootDir, 'exports')
  }
}

export function ensureUserDataPaths(): UserDataPaths {
  const paths = getUserDataPaths()

  // 启动时只创建目录，不清理目录。
  // 笔记和附件属于用户数据，任何删除/修复都必须由明确功能完成。
  fs.mkdirSync(paths.rootDir, { recursive: true })
  fs.mkdirSync(paths.attachmentsDir, { recursive: true })
  fs.mkdirSync(paths.backupsDir, { recursive: true })
  fs.mkdirSync(paths.exportsDir, { recursive: true })

  return paths
}
