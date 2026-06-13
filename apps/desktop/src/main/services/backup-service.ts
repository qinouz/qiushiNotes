import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { app } from 'electron'
import type { BackupResult, RestoreBackupResult } from '@qiushi-notes/shared'
import { closeDatabase, getDatabaseContext } from '../db/database'

interface BackupManifest {
  app: 'qiushi-notes'
  version: 1
  createdAt: string
  databaseFile: 'notes.db'
  attachmentsDir: 'attachments'
}

interface TarEntry {
  name: string
  data?: Buffer
  filePath?: string
  type: 'file' | 'directory'
}

const BACKUP_APP_ID = 'qiushi-notes'
const BACKUP_VERSION = 1
const TAR_BLOCK_SIZE = 512

export function createBackup(): BackupResult {
  const { db, paths } = getDatabaseContext()
  const createdAt = new Date().toISOString()
  const backupId = toBackupId(createdAt)
  const tempDir = path.join(paths.backupsDir, `.tmp-backup-${backupId}-${randomUUID()}`)
  const snapshotPath = path.join(tempDir, 'notes.db')
  const fileName = `qiushi-notes-backup-${backupId}.tar.gz`
  const filePath = path.join(paths.backupsDir, fileName)

  fs.mkdirSync(tempDir, { recursive: true })

  try {
    // SQLite 处于 WAL 模式时不能只复制 notes.db 文件；VACUUM INTO 会生成一致性的单文件快照，
    // 避免备份包里漏掉还停留在 WAL 文件中的最近写入。
    db.exec(`VACUUM INTO ${toSqlString(snapshotPath)}`)

    const manifest: BackupManifest = {
      app: BACKUP_APP_ID,
      version: BACKUP_VERSION,
      createdAt,
      databaseFile: 'notes.db',
      attachmentsDir: 'attachments'
    }

    const entries: TarEntry[] = [
      {
        name: 'manifest.json',
        type: 'file',
        data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
      },
      { name: 'notes.db', type: 'file', filePath: snapshotPath },
      { name: 'attachments/', type: 'directory' },
      ...collectAttachmentEntries(paths.attachmentsDir)
    ]

    fs.writeFileSync(filePath, gzipSync(createTar(entries)))
    const stat = fs.statSync(filePath)

    return {
      filePath,
      fileName,
      sizeBytes: stat.size,
      createdAt
    }
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true })
  }
}

export function restoreBackupFromFile(backupFilePath: string): RestoreBackupResult {
  const { paths } = getDatabaseContext()
  const restoreId = `${toBackupId(new Date().toISOString())}-${randomUUID()}`
  const tempDir = path.join(paths.backupsDir, `.tmp-restore-${restoreId}`)

  fs.mkdirSync(tempDir, { recursive: true })

  try {
    extractTarGzip(backupFilePath, tempDir)
    const manifest = readManifest(path.join(tempDir, 'manifest.json'))
    const restoredDatabasePath = path.join(tempDir, manifest.databaseFile)
    const restoredAttachmentsPath = path.join(tempDir, manifest.attachmentsDir)

    if (!fs.existsSync(restoredDatabasePath)) {
      throw new Error('备份文件缺少 notes.db，无法恢复。')
    }

    // 恢复是整包替换，必须先为当前数据创建完整安全备份，避免误选文件后没有回退点。
    createBackup()
    closeDatabase()

    fs.copyFileSync(restoredDatabasePath, paths.databasePath)
    removeIfExists(`${paths.databasePath}-wal`)
    removeIfExists(`${paths.databasePath}-shm`)

    fs.rmSync(paths.attachmentsDir, { force: true, recursive: true })
    if (fs.existsSync(restoredAttachmentsPath)) {
      fs.cpSync(restoredAttachmentsPath, paths.attachmentsDir, { recursive: true })
    } else {
      fs.mkdirSync(paths.attachmentsDir, { recursive: true })
    }

    // 恢复后重启，让 SQLite 连接和 renderer 状态都从恢复后的数据重新初始化。
    app.relaunch()
    app.exit(0)

    return {
      restored: true,
      cancelled: false
    }
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true })
  }
}

function collectAttachmentEntries(attachmentsDir: string): TarEntry[] {
  if (!fs.existsSync(attachmentsDir)) {
    return []
  }

  const entries: TarEntry[] = []
  walkDirectory(attachmentsDir, 'attachments', entries)
  return entries
}

function walkDirectory(sourceDir: string, archiveDir: string, entries: TarEntry[]): void {
  for (const item of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, item.name)
    const archivePath = `${archiveDir}/${item.name}`

    if (item.isDirectory()) {
      entries.push({ name: `${archivePath}/`, type: 'directory' })
      walkDirectory(sourcePath, archivePath, entries)
    } else if (item.isFile()) {
      entries.push({ name: archivePath, type: 'file', filePath: sourcePath })
    }
  }
}

function createTar(entries: TarEntry[]): Buffer {
  const chunks: Buffer[] = []

  for (const entry of entries) {
    const data = entry.type === 'file' ? entry.data ?? fs.readFileSync(entry.filePath ?? '') : Buffer.alloc(0)
    chunks.push(createTarHeader(entry.name, entry.type, data.length))

    if (entry.type === 'file') {
      chunks.push(data)
      chunks.push(Buffer.alloc(getPaddingSize(data.length)))
    }
  }

  chunks.push(Buffer.alloc(TAR_BLOCK_SIZE * 2))
  return Buffer.concat(chunks)
}

function createTarHeader(entryName: string, type: TarEntry['type'], size: number): Buffer {
  const header = Buffer.alloc(TAR_BLOCK_SIZE, 0)
  const { name, prefix } = splitTarName(entryName)

  writeString(header, name, 0, 100)
  writeOctal(header, type === 'directory' ? 0o755 : 0o644, 100, 8)
  writeOctal(header, 0, 108, 8)
  writeOctal(header, 0, 116, 8)
  writeOctal(header, type === 'directory' ? 0 : size, 124, 12)
  writeOctal(header, Math.floor(Date.now() / 1000), 136, 12)
  header.fill(0x20, 148, 156)
  writeString(header, type === 'directory' ? '5' : '0', 156, 1)
  writeString(header, 'ustar', 257, 6)
  writeString(header, '00', 263, 2)
  writeString(header, prefix, 345, 155)

  const checksum = header.reduce((sum, value) => sum + value, 0)
  writeOctal(header, checksum, 148, 8)

  return header
}

function extractTarGzip(backupFilePath: string, targetDir: string): void {
  const data = gunzipSync(fs.readFileSync(backupFilePath))
  let offset = 0

  while (offset + TAR_BLOCK_SIZE <= data.length) {
    const header = data.subarray(offset, offset + TAR_BLOCK_SIZE)

    if (header.every((value) => value === 0)) {
      break
    }

    const name = readTarName(header)
    const size = readOctal(header, 124, 12)
    const type = String.fromCharCode(header[156] || 0)
    const contentStart = offset + TAR_BLOCK_SIZE
    const contentEnd = contentStart + size
    const targetPath = toSafeExtractPath(targetDir, name)

    if (contentEnd > data.length) {
      throw new Error(`备份条目内容不完整：${name}`)
    }

    if (type === '5' || name.endsWith('/')) {
      fs.mkdirSync(targetPath, { recursive: true })
    } else {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true })
      fs.writeFileSync(targetPath, data.subarray(contentStart, contentEnd))
    }

    offset = contentEnd + getPaddingSize(size)
  }
}

function readManifest(manifestPath: string): BackupManifest {
  if (!fs.existsSync(manifestPath)) {
    throw new Error('备份文件缺少 manifest.json，无法校验来源。')
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest

  if (
    manifest.app !== BACKUP_APP_ID ||
    manifest.version !== BACKUP_VERSION ||
    manifest.databaseFile !== 'notes.db' ||
    manifest.attachmentsDir !== 'attachments'
  ) {
    throw new Error('备份 manifest 与当前应用版本不兼容。')
  }

  return manifest
}

function splitTarName(entryName: string): { name: string; prefix: string } {
  const normalized = entryName.replace(/\\/g, '/')
  const bytes = Buffer.byteLength(normalized)

  if (bytes <= 100) {
    return { name: normalized, prefix: '' }
  }

  const parts = normalized.split('/')
  const name = parts.pop() ?? ''
  const prefix = parts.join('/')

  if (Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) {
    throw new Error(`备份条目路径过长：${entryName}`)
  }

  return { name, prefix }
}

function readTarName(header: Buffer): string {
  const name = readString(header, 0, 100)
  const prefix = readString(header, 345, 155)
  return prefix ? `${prefix}/${name}` : name
}

function writeString(buffer: Buffer, value: string, offset: number, length: number): void {
  buffer.write(value, offset, Math.min(Buffer.byteLength(value), length), 'utf8')
}

function readString(buffer: Buffer, offset: number, length: number): string {
  const raw = buffer.subarray(offset, offset + length)
  const end = raw.indexOf(0)
  return raw.subarray(0, end >= 0 ? end : raw.length).toString('utf8')
}

function writeOctal(buffer: Buffer, value: number, offset: number, length: number): void {
  const text = value.toString(8).padStart(length - 1, '0')
  buffer.write(text.slice(0, length - 1), offset, length - 1, 'ascii')
  buffer[offset + length - 1] = 0
}

function readOctal(buffer: Buffer, offset: number, length: number): number {
  const text = readString(buffer, offset, length).trim()
  return text ? Number.parseInt(text, 8) : 0
}

function getPaddingSize(size: number): number {
  return (TAR_BLOCK_SIZE - (size % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE
}

function toSafeExtractPath(targetDir: string, entryName: string): string {
  const normalized = entryName.replace(/\\/g, '/')

  if (path.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new Error(`备份条目路径不安全：${entryName}`)
  }

  const resolved = path.resolve(targetDir, normalized)
  const resolvedRoot = path.resolve(targetDir)

  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`备份条目路径不安全：${entryName}`)
  }

  return resolved
}

function toSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function toBackupId(value: string): string {
  return value.replace(/[:.]/g, '-')
}

function removeIfExists(targetPath: string): void {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { force: true })
  }
}
