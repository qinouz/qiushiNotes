import { randomUUID } from 'node:crypto'
import {
  compareDisplayText,
  type CreateNoteInput,
  type ListNotesInput,
  type NoteContentFormat,
  type NoteDetail,
  type NoteSummary,
  type TrashedNoteSummary,
  type UpdateNotePatch
} from '@qiushi-notes/shared'
import { getDatabaseContext } from '../db/database'
import { ensureDefaultNotebook } from './notebook-service'
import { removeNoteFromSearchIndex, syncNoteSearchIndex } from './search-service'

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

interface TrashedNoteSummaryRow extends NoteSummaryRow {
  notebook_name: string | null
}

interface RestoreTargetRow {
  notebook_id: string | null
  active_notebook_id: string | null
}

const DEFAULT_NOTE_TITLE = '未命名笔记'
const EMPTY_TIPTAP_DOCUMENT = '{"type":"doc","content":[{"type":"paragraph"}]}'
const SPREADSHEET_SCHEMA_VERSION = 1
const SPREADSHEET_ENGINE_VERSION = '0.25.0'

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

export function listTrashedNotes(): TrashedNoteSummary[] {
  const { db } = getDatabaseContext()
  const rows = db
    .prepare(
      `
        SELECT
          notes.id,
          notes.title,
          substr(notes.content, 1, 4000) AS content,
          notes.content_format,
          notes.notebook_id,
          notes.is_favorite,
          notes.is_pinned,
          notes.updated_at,
          notes.deleted_at,
          notes.sync_status,
          notebooks.name AS notebook_name
        FROM notes
        LEFT JOIN notebooks
          ON notes.notebook_id = notebooks.id
          AND notebooks.deleted_at IS NULL
        WHERE notes.deleted_at IS NOT NULL
        ORDER BY notes.deleted_at DESC, notes.updated_at DESC
      `
    )
    .all() as unknown as TrashedNoteSummaryRow[]

  return rows.map(mapTrashedSummaryRow)
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
  const content = input.content ?? createDefaultContent(id, contentFormat)

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

  syncNoteSearchIndex(id)

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

  syncNoteSearchIndex(id)

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

  removeNoteFromSearchIndex(id)
}

export function restoreNote(id: string): NoteDetail {
  const { db } = getDatabaseContext()
  const target = db
    .prepare(
      `
        SELECT
          notes.notebook_id,
          notebooks.id AS active_notebook_id
        FROM notes
        LEFT JOIN notebooks
          ON notes.notebook_id = notebooks.id
          AND notebooks.deleted_at IS NULL
        WHERE notes.id = ? AND notes.deleted_at IS NOT NULL
      `
    )
    .get(id) as unknown as RestoreTargetRow | undefined

  if (!target) {
    throw new Error(`Note ${id} does not exist or has already been restored.`)
  }

  const restoreNotebookId = target.notebook_id && target.active_notebook_id
    ? target.notebook_id
    : ensureDefaultNotebook().id
  const now = new Date().toISOString()

  // 恢复只清空 deleted_at，不重建记录、不改正文，也不碰附件文件。
  // 如果原笔记本不可用，则恢复到默认笔记本，保证用户能在普通列表里重新找到它。
  db.prepare(
    `
      UPDATE notes
      SET
        notebook_id = ?,
        deleted_at = NULL,
        updated_at = ?,
        version = version + 1,
        sync_status = 'pending'
      WHERE id = ? AND deleted_at IS NOT NULL
    `
  ).run(restoreNotebookId, now, id)

  const restored = getNote(id)

  if (!restored) {
    throw new Error(`Failed to restore note ${id}.`)
  }

  syncNoteSearchIndex(id)

  return restored
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

function mapTrashedSummaryRow(row: TrashedNoteSummaryRow): TrashedNoteSummary {
  const summary = mapSummaryRow(row)

  if (!summary.deletedAt) {
    throw new Error(`Trashed note ${row.id} is missing deleted_at.`)
  }

  return {
    ...summary,
    deletedAt: summary.deletedAt,
    notebookName: row.notebook_name
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
  if (format === 'markdown' || format === 'tiptap-json' || format === 'spreadsheet-json') {
    return format
  }

  return 'plain-text'
}

function extractContentPreview(content: string, format: string): string {
  const normalizedFormat = normalizeContentFormat(format)

  if (normalizedFormat === 'spreadsheet-json') {
    return extractSpreadsheetText(content).slice(0, 120)
  }

  if (normalizedFormat !== 'tiptap-json') {
    return content.slice(0, 120)
  }

  try {
    const parsed = JSON.parse(content) as unknown
    return collectTiptapText(parsed).trim().slice(0, 120)
  } catch {
    return ''
  }
}

function createDefaultContent(noteId: string, format: NoteContentFormat): string {
  if (format === 'tiptap-json') {
    return EMPTY_TIPTAP_DOCUMENT
  }

  if (format === 'spreadsheet-json') {
    return JSON.stringify(createDailyReportSpreadsheet(noteId))
  }

  return ''
}

function createDailyReportSpreadsheet(noteId: string): Record<string, unknown> {
  const workbookId = `spreadsheet-${noteId}`
  const sheetId = 'sheet-1'

  // Store Univer's workbook snapshot as a whole. The app owns the note lifecycle,
  // while Univer owns spreadsheet interaction details such as selections and row sizing.
  return {
    schemaVersion: SPREADSHEET_SCHEMA_VERSION,
    engine: 'univer',
    engineVersion: SPREADSHEET_ENGINE_VERSION,
    workbook: {
      id: workbookId,
      name: '日报表格',
      appVersion: '3.0.0',
      locale: 'zhCN',
      styles: {},
      sheetOrder: [sheetId],
      sheets: {
        [sheetId]: {
          id: sheetId,
          name: 'Sheet1',
          tabColor: '',
          hidden: 0,
          freeze: {
            xSplit: 0,
            ySplit: 1,
            startRow: 1,
            startColumn: 0
          },
          rowCount: 100,
          columnCount: 20,
          zoomRatio: 1,
          scrollTop: 0,
          scrollLeft: 0,
          defaultColumnWidth: 120,
          defaultRowHeight: 28,
          mergeData: [],
          cellData: {
            0: {
              0: { v: '日期' },
              1: { v: '任务项' },
              2: { v: '优先级' },
              3: { v: '状态' },
              4: { v: '备注' }
            }
          },
          rowData: {
            0: { h: 32 }
          },
          columnData: {
            0: { w: 90 },
            1: { w: 280 },
            2: { w: 100 },
            3: { w: 100 },
            4: { w: 220 }
          },
          rowHeader: {
            width: 46
          },
          columnHeader: {
            height: 24
          },
          showGridlines: 1,
          rightToLeft: 0
        }
      }
    }
  }
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
    return ''
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
