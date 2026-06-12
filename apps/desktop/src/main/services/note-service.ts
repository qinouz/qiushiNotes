import { randomUUID } from 'node:crypto'
import {
  compareDisplayText,
  type CreateNoteInput,
  type ListNotesInput,
  type NoteContentFormat,
  type NoteDetail,
  type NoteSummary,
  type UpdateNotePatch
} from '@qiushi-notes/shared'
import { getDatabaseContext } from '../db/database'

interface NoteSummaryRow {
  id: string
  title: string
  content: string
  notebook_id: string | null
  content_format: string
  is_favorite: number
  is_pinned: number
  updated_at: string
  deleted_at: string | null
  sync_status: NoteSummary['syncStatus']
}

interface NoteDetailRow extends NoteSummaryRow {
  created_at: string
  version: number
}

const DEFAULT_NOTE_TITLE = '未命名笔记'
const EMPTY_TIPTAP_DOCUMENT = '{"type":"doc","content":[{"type":"paragraph"}]}'

export function listNotes(input: ListNotesInput = {}): NoteSummary[] {
  const { db } = getDatabaseContext()
  const shouldFilterByNotebook = typeof input.notebookId === 'string' && input.notebookId.length > 0

  const rows = db
    .prepare(
      `
        SELECT
          id,
          title,
          substr(content, 1, 4000) AS content,
          content_format,
          notebook_id,
          is_favorite,
          is_pinned,
          updated_at,
          deleted_at,
          sync_status
        FROM notes
        WHERE deleted_at IS NULL
          AND (? = 0 OR notebook_id = ?)
      `
    )
    .all(shouldFilterByNotebook ? 1 : 0, input.notebookId ?? null) as unknown as NoteSummaryRow[]

  // 默认浏览顺序按标题/拼音稳定排序，不能因为自动保存更新 updated_at 就让当前笔记跳到列表顶部。
  return rows.map(mapSummaryRow).sort(compareNoteSummariesForDisplay)
}

export function getNote(id: string): NoteDetail | null {
  const { db } = getDatabaseContext()

  const row = db
    .prepare(
      `
        SELECT
          id,
          title,
          substr(content, 1, 120) AS content_preview,
          content,
          content_format,
          notebook_id,
          is_favorite,
          is_pinned,
          created_at,
          updated_at,
          deleted_at,
          version,
          sync_status
        FROM notes
        WHERE id = ? AND deleted_at IS NULL
      `
    )
    .get(id) as unknown as NoteDetailRow | undefined

  return row ? mapDetailRow(row) : null
}

export function createNote(input: CreateNoteInput = {}): NoteDetail {
  const { db } = getDatabaseContext()
  const id = randomUUID()
  const now = new Date().toISOString()
  const contentFormat = normalizeContentFormat(input.contentFormat ?? 'tiptap-json')
  const content = input.content ?? (contentFormat === 'tiptap-json' ? EMPTY_TIPTAP_DOCUMENT : '')

  // 笔记 ID 在本地生成，未来同步时服务器只接收这个 ID，不再反向决定本地记录身份。
  // content_format 区分普通富文本、旧纯文本和 Markdown，后续导出/同步可以稳定识别正文结构。
  db.prepare(
    `
      INSERT INTO notes (
        id,
        notebook_id,
        title,
        content,
        content_format,
        is_favorite,
        is_pinned,
        created_at,
        updated_at,
        version,
        sync_status
      )
      VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, 1, 'local')
    `
  ).run(
    id,
    input.notebookId ?? null,
    normalizeTitle(input.title),
    content,
    contentFormat,
    now,
    now
  )

  const created = getNote(id)

  if (!created) {
    throw new Error(`Failed to create note ${id}.`)
  }

  return created
}

export function updateNote(id: string, patch: UpdateNotePatch): NoteDetail {
  const current = getNote(id)

  if (!current) {
    throw new Error(`Note ${id} does not exist or has been deleted.`)
  }

  const nextNotebookId = hasOwn(patch, 'notebookId') ? patch.notebookId ?? null : current.notebookId
  const nextTitle = hasOwn(patch, 'title') ? normalizeTitle(patch.title) : current.title
  const nextContent = hasOwn(patch, 'content') ? patch.content ?? '' : current.content
  const nextContentFormat = hasOwn(patch, 'contentFormat') && patch.contentFormat !== undefined
    ? normalizeContentFormat(patch.contentFormat)
    : current.contentFormat
  const nextFavorite = hasOwn(patch, 'isFavorite') ? Boolean(patch.isFavorite) : current.isFavorite
  const nextPinned = hasOwn(patch, 'isPinned') ? Boolean(patch.isPinned) : current.isPinned
  const now = new Date().toISOString()
  const { db } = getDatabaseContext()

  // 更新时统一维护 version 和 sync_status，避免 UI 层绕过同步预留规则。
  db.prepare(
    `
      UPDATE notes
      SET
        notebook_id = ?,
        title = ?,
        content = ?,
        content_format = ?,
        is_favorite = ?,
        is_pinned = ?,
        updated_at = ?,
        version = version + 1,
        sync_status = 'pending'
      WHERE id = ? AND deleted_at IS NULL
    `
  ).run(
    nextNotebookId,
    nextTitle,
    nextContent,
    nextContentFormat,
    nextFavorite ? 1 : 0,
    nextPinned ? 1 : 0,
    now,
    id
  )

  const updated = getNote(id)

  if (!updated) {
    throw new Error(`Failed to update note ${id}.`)
  }

  return updated
}

export function softDeleteNote(id: string): void {
  const { db } = getDatabaseContext()
  const now = new Date().toISOString()

  // 删除只写 deleted_at。真正物理删除要等回收站、备份和同步策略都设计清楚后再做。
  const result = db
    .prepare(
      `
        UPDATE notes
        SET
          deleted_at = ?,
          updated_at = ?,
          version = version + 1,
          sync_status = 'pending'
        WHERE id = ? AND deleted_at IS NULL
      `
    )
    .run(now, now, id) as { changes: number }

  if (result.changes === 0) {
    throw new Error(`Note ${id} does not exist or has already been deleted.`)
  }
}

function mapSummaryRow(row: NoteSummaryRow): NoteSummary {
  return {
    id: row.id,
    title: row.title || DEFAULT_NOTE_TITLE,
    contentPreview: extractContentPreview(row.content, row.content_format),
    notebookId: row.notebook_id,
    contentFormat: normalizeContentFormat(row.content_format),
    isFavorite: row.is_favorite === 1,
    isPinned: row.is_pinned === 1,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status
  }
}

function mapDetailRow(row: NoteDetailRow): NoteDetail {
  return {
    ...mapSummaryRow(row),
    content: row.content,
    createdAt: row.created_at,
    version: row.version
  }
}

function compareNoteSummariesForDisplay(left: NoteSummary, right: NoteSummary): number {
  if (left.isPinned !== right.isPinned) {
    return left.isPinned ? -1 : 1
  }

  const titleOrder = compareDisplayText(left.title, right.title)

  if (titleOrder !== 0) {
    return titleOrder
  }

  return left.id.localeCompare(right.id)
}

function normalizeTitle(title: string | undefined): string {
  const trimmed = title?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_NOTE_TITLE
}

function normalizeContentFormat(format: string | undefined): NoteContentFormat {
  if (format === 'markdown' || format === 'tiptap-json') {
    return format
  }

  return 'plain-text'
}

function extractContentPreview(content: string, format: string): string {
  if (normalizeContentFormat(format) !== 'tiptap-json') {
    return content.slice(0, 120)
  }

  try {
    const parsed = JSON.parse(content) as unknown
    return collectTiptapText(parsed).trim().slice(0, 120)
  } catch {
    return ''
  }
}

function collectTiptapText(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return ''
  }

  const record = node as { text?: unknown; content?: unknown }
  const ownText = typeof record.text === 'string' ? record.text : ''

  if (!Array.isArray(record.content)) {
    return ownText
  }

  return [ownText, ...record.content.map(collectTiptapText)].filter(Boolean).join(' ')
}

function hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}
