import { randomUUID, createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type {
  AttachmentDetail,
  SaveImageAttachmentInput,
  SyncStatus
} from '@qiushi-notes/shared'
import { getDatabaseContext } from '../db/database'
import { getNote } from './note-service'

interface AttachmentRow {
  id: string
  note_id: string | null
  file_name: string
  mime_type: string | null
  size: number
  sha256: string | null
  relative_path: string
  created_at: string
  deleted_at: string | null
  sync_status: SyncStatus
}

interface AttachmentFileRef {
  filePath: string
  mimeType: string
}

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024
const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp'
}

export function saveImageAttachment(input: SaveImageAttachmentInput): AttachmentDetail {
  const note = getNote(input.noteId)

  if (!note) {
    throw new Error('当前笔记不存在或已被删除，无法保存图片。')
  }

  const extension = getImageExtension(input.mimeType)
  const data = Buffer.from(input.data)

  if (data.byteLength === 0) {
    throw new Error('图片内容为空，无法保存。')
  }

  if (data.byteLength > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('图片超过 20 MB，暂不支持粘贴。')
  }

  const { db, paths } = getDatabaseContext()
  const id = randomUUID()
  const now = new Date().toISOString()
  const relativePath = buildAttachmentRelativePath(id, extension, now)
  const targetPath = resolveUserDataRelativePath(paths.rootDir, relativePath)
  const fileName = normalizeFileName(input.fileName, extension)
  const sha256 = createHash('sha256').update(data).digest('hex')

  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, data)

  try {
    db.prepare(
      `
        INSERT INTO attachments (
          id,
          note_id,
          file_name,
          mime_type,
          size,
          sha256,
          relative_path,
          created_at,
          version,
          sync_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'local')
      `
    ).run(id, note.id, fileName, input.mimeType, data.byteLength, sha256, relativePath, now)
  } catch (error) {
    fs.rmSync(targetPath, { force: true })
    throw error
  }

  const created = getAttachment(id)

  if (!created) {
    fs.rmSync(targetPath, { force: true })
    throw new Error('图片附件记录创建失败。')
  }

  return created
}

export function getAttachment(id: string): AttachmentDetail | null {
  const { db } = getDatabaseContext()
  const row = db
    .prepare(
      `
        SELECT
          id,
          note_id,
          file_name,
          mime_type,
          size,
          sha256,
          relative_path,
          created_at,
          deleted_at,
          sync_status
        FROM attachments
        WHERE id = ? AND deleted_at IS NULL
      `
    )
    .get(id) as unknown as AttachmentRow | undefined

  return row ? mapAttachmentRow(row) : null
}

export function getAttachmentFile(id: string): AttachmentFileRef | null {
  const attachment = getAttachment(id)

  if (!attachment || !attachment.mimeType) {
    return null
  }

  const { paths } = getDatabaseContext()
  const filePath = resolveUserDataRelativePath(paths.rootDir, attachment.relativePath)

  if (!fs.existsSync(filePath)) {
    return null
  }

  return {
    filePath,
    mimeType: attachment.mimeType
  }
}

function mapAttachmentRow(row: AttachmentRow): AttachmentDetail {
  return {
    id: row.id,
    noteId: row.note_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    size: row.size,
    sha256: row.sha256,
    relativePath: row.relative_path,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
    url: toAttachmentUrl(row.id)
  }
}

function getImageExtension(mimeType: string): string {
  const extension = IMAGE_MIME_EXTENSIONS[mimeType]

  if (!extension) {
    throw new Error('仅支持粘贴 PNG、JPEG、GIF 和 WebP 图片。')
  }

  return extension
}

function buildAttachmentRelativePath(id: string, extension: string, createdAt: string): string {
  const date = new Date(createdAt)
  const year = `${date.getUTCFullYear()}`
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')

  return `attachments/${year}/${month}/${id}.${extension}`
}

function normalizeFileName(fileName: string, extension: string): string {
  const trimmed = fileName.trim()
  const safeBaseName = trimmed ? path.parse(trimmed).name : '粘贴图片'
  return `${safeBaseName.slice(0, 80) || '粘贴图片'}.${extension}`
}

function toAttachmentUrl(id: string): string {
  return `qiushi-attachment://${encodeURIComponent(id)}`
}

function resolveUserDataRelativePath(rootDir: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/')

  if (path.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new Error('附件路径不安全。')
  }

  const resolvedRoot = path.resolve(rootDir)
  const resolved = path.resolve(rootDir, ...normalized.split('/'))

  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('附件路径不安全。')
  }

  return resolved
}
