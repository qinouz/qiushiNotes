import { pinyin } from 'pinyin-pro'

export type SyncStatus = 'local' | 'pending' | 'synced' | 'conflicted'

export interface CreateNoteInput {
  notebookId?: string | null
  title?: string
  content?: string
}

export interface ListNotesInput {
  notebookId?: string | null
}

export interface CreateNotebookInput {
  parentId?: string | null
  name?: string
}

export interface UpdateNotebookPatch {
  name?: string
}

export interface UpdateNotePatch {
  notebookId?: string | null
  title?: string
  content?: string
  isFavorite?: boolean
  isPinned?: boolean
}

export interface NoteSummary {
  id: string
  title: string
  contentPreview: string
  notebookId: string | null
  isFavorite: boolean
  isPinned: boolean
  updatedAt: string
  deletedAt: string | null
  syncStatus: SyncStatus
}

export interface NoteDetail extends NoteSummary {
  content: string
  contentFormat: string
  createdAt: string
  version: number
}

export interface NotebookSummary {
  id: string
  parentId: string | null
  name: string
  sortOrder: number
  updatedAt: string
  deletedAt: string | null
  syncStatus: SyncStatus
}

export type NoteTreeNodeType = 'notebook' | 'note'

export interface NoteTreeNode {
  type: NoteTreeNodeType
  id: string
  name: string
  depth: number
  isExpanded: boolean
  notebookId?: string
  noteId?: string
  contentPreview?: string
  updatedAt?: string
}

const displayNameCollator = new Intl.Collator('en-US', {
  numeric: true,
  sensitivity: 'base'
})

export function compareDisplayText(left: string, right: string): number {
  const leftKey = toDisplaySortKey(left)
  const rightKey = toDisplaySortKey(right)
  const keyOrder = displayNameCollator.compare(leftKey, rightKey)

  if (keyOrder !== 0) {
    return keyOrder
  }

  return displayNameCollator.compare(left.trim(), right.trim())
}

function toDisplaySortKey(value: string): string {
  const normalized = value.trim().normalize('NFKC')

  if (!normalized) {
    return ''
  }

  // 用拼音排序键模拟常见笔记软件的“首字母排序”：中文按拼音，英文保留字母，数字交给 Intl 做自然排序。
  return pinyin(normalized, {
    toneType: 'none',
    type: 'array'
  })
    .join('')
    .toLocaleLowerCase('en-US')
}
