export type SyncStatus = 'local' | 'pending' | 'synced' | 'conflicted'

export interface CreateNoteInput {
  notebookId?: string | null
  title?: string
  content?: string
}

export interface ListNotesInput {
  notebookId?: string | null
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
