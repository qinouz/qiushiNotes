import { randomUUID } from 'node:crypto'
import {
  compareDisplayText,
  type CreateNotebookInput,
  type NotebookSummary,
  type UpdateNotebookPatch
} from '@qiushi-notes/shared'
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
const DEFAULT_NEW_NOTEBOOK_NAME = '新建笔记本'
const MAX_NOTEBOOK_NAME_LENGTH = 80

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

  return rows.map(mapNotebookRow).sort(compareNotebookSummariesForDisplay)
}

export function createNotebook(input: CreateNotebookInput = {}): NotebookSummary {
  const { db } = getDatabaseContext()
  const parentId = normalizeParentId(input.parentId)
  const name = normalizeNotebookName(input.name)
  const id = randomUUID()
  const now = new Date().toISOString()

  if (parentId) {
    assertActiveNotebookExists(parentId)
  }

  const nextSortOrder = getNextSortOrder(parentId)

  // 笔记本是未来同步对象，即使现在只在本地创建，也必须保留 UUID、版本和同步状态。
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
      VALUES (?, ?, ?, ?, ?, ?, 1, 'local')
    `
  ).run(id, parentId, name, nextSortOrder, now, now)

  const created = getNotebook(id)

  if (!created) {
    throw new Error(`Failed to create notebook ${id}.`)
  }

  return created
}

export function updateNotebook(
  id: string,
  patch: UpdateNotebookPatch | null = {}
): NotebookSummary {
  const normalizedId = normalizeNotebookId(id)

  assertActiveNotebookExists(normalizedId)

  const name = normalizeNotebookName(patch?.name)
  const now = new Date().toISOString()
  const { db } = getDatabaseContext()

  // 重命名属于用户数据变更，需要推进 version 并标记为 pending，给未来同步留下明确差异。
  db.prepare(
    `
      UPDATE notebooks
      SET
        name = ?,
        updated_at = ?,
        version = version + 1,
        sync_status = 'pending'
      WHERE id = ? AND deleted_at IS NULL
    `
  ).run(name, now, normalizedId)

  const updated = getNotebook(normalizedId)

  if (!updated) {
    throw new Error(`Failed to update notebook ${normalizedId}.`)
  }

  return updated
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

function assertActiveNotebookExists(id: string): void {
  if (!getNotebook(id)) {
    throw new Error(`Notebook ${id} does not exist or has been deleted.`)
  }
}

function getNextSortOrder(parentId: string | null): number {
  const { db } = getDatabaseContext()
  const row = db
    .prepare(
      `
        SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
        FROM notebooks
        WHERE deleted_at IS NULL
          AND (
            (? IS NULL AND parent_id IS NULL)
            OR parent_id = ?
          )
      `
    )
    .get(parentId, parentId) as { next_sort_order: number } | undefined

  return row?.next_sort_order ?? 0
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

function compareNotebookSummariesForDisplay(
  left: NotebookSummary,
  right: NotebookSummary
): number {
  const sortOrder = left.sortOrder - right.sortOrder

  if (sortOrder !== 0) {
    return sortOrder
  }

  const nameOrder = compareDisplayText(left.name, right.name)

  if (nameOrder !== 0) {
    return nameOrder
  }

  return left.id.localeCompare(right.id)
}

function normalizeParentId(parentId: string | null | undefined): string | null {
  if (typeof parentId !== 'string') {
    return null
  }

  const trimmed = parentId.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeNotebookId(id: string): string {
  if (typeof id !== 'string') {
    throw new Error('Notebook id must be a string.')
  }

  const trimmed = id.trim()

  if (!trimmed) {
    throw new Error('Notebook id is required.')
  }

  return trimmed
}

function normalizeNotebookName(name: string | undefined): string {
  const trimmed = name?.trim() ?? ''
  const normalized = trimmed.length > 0 ? trimmed : DEFAULT_NEW_NOTEBOOK_NAME

  return normalized.slice(0, MAX_NOTEBOOK_NAME_LENGTH)
}
