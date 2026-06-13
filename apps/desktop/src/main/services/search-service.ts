import type {
  NoteContentFormat,
  SearchNoteResult,
  SearchNotesInput,
  SyncStatus
} from '@qiushi-notes/shared'
import { getDatabaseContext } from '../db/database'

interface IndexableNoteRow {
  id: string
  title: string
  content: string
  content_format: string
  updated_at: string
  deleted_at: string | null
}

interface SearchResultRow {
  id: string
  title: string
  content_text: string
  content_format: string
  notebook_id: string | null
  notebook_name: string | null
  is_favorite: number
  is_pinned: number
  updated_at: string
  deleted_at: string | null
  sync_status: SyncStatus
}

const MAX_QUERY_LENGTH = 80
const MAX_RESULTS = 100

export function rebuildNoteSearchIndex(): void {
  const { db } = getDatabaseContext()
  const rows = db
    .prepare(
      `
        SELECT id, title, content, content_format, updated_at, deleted_at
        FROM notes
      `
    )
    .all() as unknown as IndexableNoteRow[]

  db.exec('BEGIN')

  try {
    db.prepare('DELETE FROM note_search_index').run()

    for (const row of rows) {
      if (!row.deleted_at) {
        upsertNoteSearchIndexRow(row)
      }
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function syncNoteSearchIndex(noteId: string): void {
  const row = getIndexableNoteRow(noteId)

  if (!row || row.deleted_at) {
    removeNoteFromSearchIndex(noteId)
    return
  }

  upsertNoteSearchIndexRow(row)
}

export function removeNoteFromSearchIndex(noteId: string): void {
  const { db } = getDatabaseContext()
  db.prepare('DELETE FROM note_search_index WHERE note_id = ?').run(noteId)
}

export function searchNotes(input: SearchNotesInput): SearchNoteResult[] {
  const query = normalizeSearchQuery(input.query)

  if (!query) {
    return []
  }

  const escapedPattern = `%${escapeLikePattern(query)}%`
  const { db } = getDatabaseContext()
  const rows = db
    .prepare(
      `
        SELECT
          notes.id,
          notes.title,
          note_search_index.content_text,
          notes.content_format,
          notes.notebook_id,
          notebooks.name AS notebook_name,
          notes.is_favorite,
          notes.is_pinned,
          notes.updated_at,
          notes.deleted_at,
          notes.sync_status
        FROM note_search_index
        INNER JOIN notes ON notes.id = note_search_index.note_id
        LEFT JOIN notebooks
          ON notes.notebook_id = notebooks.id
          AND notebooks.deleted_at IS NULL
        WHERE notes.deleted_at IS NULL
          AND (
            note_search_index.title LIKE ? ESCAPE '\\'
            OR note_search_index.content_text LIKE ? ESCAPE '\\'
          )
        ORDER BY notes.is_pinned DESC, notes.updated_at DESC
        LIMIT ?
      `
    )
    .all(escapedPattern, escapedPattern, MAX_RESULTS) as unknown as SearchResultRow[]

  return rows.map((row) => mapSearchResultRow(row, query))
}

function getIndexableNoteRow(noteId: string): IndexableNoteRow | null {
  const { db } = getDatabaseContext()
  const row = db
    .prepare(
      `
        SELECT id, title, content, content_format, updated_at, deleted_at
        FROM notes
        WHERE id = ?
      `
    )
    .get(noteId) as unknown as IndexableNoteRow | undefined

  return row ?? null
}

function upsertNoteSearchIndexRow(row: IndexableNoteRow): void {
  const { db } = getDatabaseContext()
  const contentText = toSearchableText(row.content, row.content_format)

  // 搜索索引是本地派生数据，不参与同步；每次以 notes 表为准覆盖。
  db.prepare(
    `
      INSERT INTO note_search_index (note_id, title, content_text, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(note_id) DO UPDATE SET
        title = excluded.title,
        content_text = excluded.content_text,
        updated_at = excluded.updated_at
    `
  ).run(row.id, row.title, contentText, row.updated_at)
}

function mapSearchResultRow(row: SearchResultRow, query: string): SearchNoteResult {
  const contentPreview = buildPreview(row.content_text, query)

  return {
    id: row.id,
    title: row.title,
    contentPreview,
    matchPreview: contentPreview,
    notebookId: row.notebook_id,
    notebookName: row.notebook_name,
    contentFormat: normalizeContentFormat(row.content_format),
    isFavorite: row.is_favorite === 1,
    isPinned: row.is_pinned === 1,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status
  }
}

function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH)
}

function escapeLikePattern(query: string): string {
  return query.replace(/[\\%_]/g, (value) => `\\${value}`)
}

function normalizeContentFormat(format: string): NoteContentFormat {
  if (format === 'markdown' || format === 'tiptap-json' || format === 'spreadsheet-json') {
    return format
  }

  return 'plain-text'
}

function toSearchableText(content: string, format: string): string {
  const normalizedFormat = normalizeContentFormat(format)

  if (normalizedFormat === 'spreadsheet-json') {
    return extractSpreadsheetText(content)
  }

  if (normalizedFormat !== 'tiptap-json') {
    return content
  }

  try {
    return collectTiptapText(JSON.parse(content) as unknown).trim()
  } catch {
    return stripJsonNoise(content)
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

function stripJsonNoise(content: string): string {
  return content.replace(/[{}[\]",:]/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractSpreadsheetText(content: string): string {
  try {
    const parsed = JSON.parse(content) as unknown
    const workbook = getSpreadsheetWorkbook(parsed)

    if (!workbook || typeof workbook !== 'object') {
      return ''
    }

    return collectSpreadsheetCellText(workbook).trim()
  } catch {
    return stripJsonNoise(content)
  }
}

function getSpreadsheetWorkbook(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as { workbook?: unknown }

  return record.workbook ?? value
}

function collectSpreadsheetCellText(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return ''
  }

  const record = value as {
    v?: unknown
    p?: { body?: { dataStream?: unknown } }
    sheets?: Record<string, { cellData?: unknown }>
  }
  const pieces: string[] = []

  if (typeof record.v === 'string' || typeof record.v === 'number' || typeof record.v === 'boolean') {
    pieces.push(String(record.v))
  }

  const dataStream = record.p?.body?.dataStream

  if (typeof dataStream === 'string') {
    pieces.push(dataStream.replace(/\r?\n/g, ' '))
  }

  if (record.sheets && typeof record.sheets === 'object') {
    for (const sheet of Object.values(record.sheets)) {
      pieces.push(collectSpreadsheetCellText(sheet.cellData))
    }
  } else {
    for (const child of Object.values(record as Record<string, unknown>)) {
      if (child && typeof child === 'object') {
        pieces.push(collectSpreadsheetCellText(child))
      }
    }
  }

  return pieces.filter(Boolean).join(' ')
}

function buildPreview(contentText: string, query: string): string {
  const normalizedContent = contentText.replace(/\s+/g, ' ').trim()

  if (!normalizedContent) {
    return ''
  }

  const index = normalizedContent.toLocaleLowerCase().indexOf(query.toLocaleLowerCase())
  const start = index > 24 ? index - 24 : 0
  const preview = normalizedContent.slice(start, start + 140)

  return `${start > 0 ? '...' : ''}${preview}${start + 140 < normalizedContent.length ? '...' : ''}`
}
