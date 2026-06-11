import type {
  CreateNotebookInput,
  CreateNoteInput,
  ListNotesInput,
  NoteDetail,
  NotebookSummary,
  NoteSummary,
  UpdateNotebookPatch,
  UpdateNotePatch
} from '@qiushi-notes/shared'

export interface QiushiApi {
  app: {
    getName: () => string
  }
  notes: {
    list: (input?: ListNotesInput) => Promise<NoteSummary[]>
    get: (id: string) => Promise<NoteDetail | null>
    create: (input?: CreateNoteInput) => Promise<NoteDetail>
    update: (id: string, patch: UpdateNotePatch) => Promise<NoteDetail>
    softDelete: (id: string) => Promise<void>
  }
  notebooks: {
    list: () => Promise<NotebookSummary[]>
    ensureDefault: () => Promise<NotebookSummary>
    create: (input?: CreateNotebookInput) => Promise<NotebookSummary>
    update: (id: string, patch: UpdateNotebookPatch) => Promise<NotebookSummary>
  }
}
