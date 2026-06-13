import fs from 'node:fs'
import path from 'node:path'
import type { ExportJsonResult } from '@qiushi-notes/shared'
import { getDatabaseContext } from '../db/database'

interface AttachmentExportRow {
  id: string
  relative_path: string
}

interface ExportPackage {
  app: 'qiushi-notes'
  format: 'qiushi-json-export'
  version: 1
  exportedAt: string
  tables: {
    notebooks: unknown[]
    notes: unknown[]
    tags: unknown[]
    noteTags: unknown[]
    attachments: unknown[]
    settings: unknown[]
  }
}

const EXPORT_APP_ID = 'qiushi-notes'
const EXPORT_FORMAT = 'qiushi-json-export'
const EXPORT_VERSION = 1
const EXPORT_FILE_NAME = 'qiushi-notes.json'

export function exportJsonPackage(): ExportJsonResult {
  const { db, paths } = getDatabaseContext()
  const exportedAt = new Date().toISOString()
  const exportId = toFileSafeTimestamp(exportedAt)
  const exportDir = path.join(paths.exportsDir, `qiushi-notes-export-${exportId}`)
  const tempDir = path.join(paths.exportsDir, `.tmp-export-${exportId}`)
  const exportFilePath = path.join(exportDir, EXPORT_FILE_NAME)

  fs.rmSync(tempDir, { force: true, recursive: true })
  fs.mkdirSync(tempDir, { recursive: true })

  try {
    const exportPackage: ExportPackage = {
      app: EXPORT_APP_ID,
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt,
      tables: {
        notebooks: db.prepare('SELECT * FROM notebooks ORDER BY sort_order ASC, updated_at ASC').all(),
        notes: db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all(),
        tags: db.prepare('SELECT * FROM tags ORDER BY name ASC').all(),
        noteTags: db.prepare('SELECT * FROM note_tags ORDER BY created_at ASC').all(),
        attachments: db.prepare('SELECT * FROM attachments ORDER BY created_at ASC').all(),
        settings: db.prepare('SELECT * FROM settings ORDER BY key ASC').all()
      }
    }

    fs.writeFileSync(
      path.join(tempDir, EXPORT_FILE_NAME),
      `${JSON.stringify(exportPackage, null, 2)}\n`,
      'utf8'
    )

    const attachmentRows = exportPackage.tables.attachments as AttachmentExportRow[]
    const { copiedAttachmentCount, missingAttachmentCount } = copyExportAttachments(
      attachmentRows,
      paths.rootDir,
      tempDir
    )

    if (fs.existsSync(exportDir)) {
      throw new Error(`导出目录已存在：${exportDir}`)
    }

    fs.renameSync(tempDir, exportDir)
    const stat = fs.statSync(exportFilePath)

    return {
      exportDir,
      filePath: exportFilePath,
      fileName: EXPORT_FILE_NAME,
      sizeBytes: stat.size,
      exportedAt,
      copiedAttachmentCount,
      missingAttachmentCount
    }
  } catch (error) {
    fs.rmSync(tempDir, { force: true, recursive: true })
    throw error
  }
}

function copyExportAttachments(
  attachments: AttachmentExportRow[],
  userDataRootDir: string,
  exportRootDir: string
): { copiedAttachmentCount: number; missingAttachmentCount: number } {
  let copiedAttachmentCount = 0
  let missingAttachmentCount = 0

  for (const attachment of attachments) {
    const safeRelativePath = normalizeSafeRelativePath(attachment.relative_path)

    if (!safeRelativePath) {
      missingAttachmentCount += 1
      continue
    }

    const sourcePath = resolveInsideRoot(userDataRootDir, safeRelativePath)
    const targetPath = resolveInsideRoot(exportRootDir, safeRelativePath)

    if (!sourcePath || !targetPath || !fs.existsSync(sourcePath)) {
      missingAttachmentCount += 1
      continue
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(sourcePath, targetPath)
    copiedAttachmentCount += 1
  }

  return { copiedAttachmentCount, missingAttachmentCount }
}

function normalizeSafeRelativePath(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, '/')

  if (path.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    return null
  }

  return normalized
}

function resolveInsideRoot(rootDir: string, relativePath: string): string | null {
  const resolvedRoot = path.resolve(rootDir)
  const resolved = path.resolve(rootDir, ...relativePath.split('/'))

  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null
  }

  return resolved
}

function toFileSafeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-')
}
