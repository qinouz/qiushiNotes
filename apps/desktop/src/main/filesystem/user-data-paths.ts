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

  if (process.env.QIUSHI_SKIP_LEGACY_MIGRATION !== '1') {
    migrateLegacyChineseUserDataDir(paths.rootDir)
  }

  // 启动时只创建目录，不清理目录。
  // 笔记和附件属于用户数据，任何删除/修复都必须由明确功能完成。
  fs.mkdirSync(paths.rootDir, { recursive: true })
  fs.mkdirSync(paths.attachmentsDir, { recursive: true })
  fs.mkdirSync(paths.backupsDir, { recursive: true })
  fs.mkdirSync(paths.exportsDir, { recursive: true })

  return paths
}

function migrateLegacyChineseUserDataDir(targetRootDir: string): void {
  const legacyRootDir = path.join(app.getPath('appData'), '秋实笔记')
  const targetDatabasePath = path.join(targetRootDir, 'notes.db')
  const legacyDatabasePath = path.join(legacyRootDir, 'notes.db')

  if (legacyRootDir === targetRootDir) {
    return
  }

  if (!fs.existsSync(legacyDatabasePath) || fs.existsSync(targetDatabasePath)) {
    return
  }

  fs.mkdirSync(targetRootDir, { recursive: true })

  // 早期版本使用中文 app name，导致 userData 路径里包含中文。
  // 在 cmd.exe 里这类路径容易显示成乱码，所以迁移到 ASCII 目录。
  // 只在新目录还没有 notes.db 时拷贝，避免覆盖用户后续产生的新数据。
  copyLegacyEntry(legacyRootDir, targetRootDir, 'notes.db')
  copyLegacyEntry(legacyRootDir, targetRootDir, 'notes.db-wal')
  copyLegacyEntry(legacyRootDir, targetRootDir, 'notes.db-shm')
  copyLegacyEntry(legacyRootDir, targetRootDir, 'attachments')
  copyLegacyEntry(legacyRootDir, targetRootDir, 'backups')
  copyLegacyEntry(legacyRootDir, targetRootDir, 'exports')

  console.info(`Migrated legacy user data from ${legacyRootDir} to ${targetRootDir}`)
}

function copyLegacyEntry(sourceRootDir: string, targetRootDir: string, entryName: string): void {
  const sourcePath = path.join(sourceRootDir, entryName)
  const targetPath = path.join(targetRootDir, entryName)

  if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
    return
  }

  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
    errorOnExist: false,
    force: false
  })
}
