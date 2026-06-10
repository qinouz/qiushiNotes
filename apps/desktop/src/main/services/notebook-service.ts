import { randomUUID } from 'node:crypto'
import type { NotebookSummary } from '@qiushi-notes/shared'
import { getDatabaseContext } from '../db/database'

interface NotebookRow {
  id: string
  parent_id: string | null
  name: string
  sort_order: number
  updated_at: string
  deleted_at: string | null
  sync_status: NotebookSummary['syncStatus']
}

const DEFAULT_NOTEBOOK_NAME = '默认笔记本'

export function ensureDefaultNotebook(): NotebookSummary {
  const existing = findDefaultNotebook()

  if (existing) {
    return existing
  }

  const { db } = getDatabaseContext()
  const id = randomUUID()
  const now = new Date().toISOString()

  // 默认笔记本也是普通本地数据，仍然使用 UUID 和同步字段。
  // 后续同步实现后，不需要为“系统默认”笔记本设计特殊 ID。
  db.prepare(
    `
      INSERT INTO notebooks (
        id,
        parent_id,
        name,
        sort_order,
        created_at,
        updated_at,
        version,
        sync_status
      )
      VALUES (?, NULL, ?, 0, ?, ?, 1, 'local')
    `
  ).run(id, DEFAULT_NOTEBOOK_NAME, now, now)

  const created = getNotebook(id)

  if (!created) {
    throw new Error('Failed to create default notebook.')
  }

  return created
}

export function listNotebooks(): NotebookSummary[] {
  const { db } = getDatabaseContext()
  const rows = db
    .prepare(
      `
        SELECT
          id,
          parent_id,
          name,
          sort_order,
          updated_at,
          deleted_at,
          sync_status
        FROM notebooks
        WHERE deleted_at IS NULL
        ORDER BY sort_order ASC, updated_at ASC
      `
    )
    .all() as unknown as NotebookRow[]

  return rows.map(mapNotebookRow)
}

function findDefaultNotebook(): NotebookSummary | null {
  const { db } = getDatabaseContext()
  const row = db
    .prepare(
      `
        SELECT
          id,
          parent_id,
          name,
          sort_order,
          updated_at,
          deleted_at,
          sync_status
        FROM notebooks
        WHERE deleted_at IS NULL AND name = ?
        ORDER BY sort_order ASC, updated_at ASC
        LIMIT 1
      `
    )
    .get(DEFAULT_NOTEBOOK_NAME) as unknown as NotebookRow | undefined

  return row ? mapNotebookRow(row) : null
}

function getNotebook(id: string): NotebookSummary | null {
  const { db } = getDatabaseContext()
  const row = db
    .prepare(
      `
        SELECT
          id,
          parent_id,
          name,
          sort_order,
          updated_at,
          deleted_at,
          sync_status
        FROM notebooks
        WHERE id = ? AND deleted_at IS NULL
      `
    )
    .get(id) as unknown as NotebookRow | undefined

  return row ? mapNotebookRow(row) : null
}

function mapNotebookRow(row: NotebookRow): NotebookSummary {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status
  }
}
