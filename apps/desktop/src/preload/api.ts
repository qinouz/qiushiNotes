import type {
  AttachmentDetail,
  BackupResult,
  CreateNotebookInput,
  CreateNoteInput,
  ExportJsonResult,
  ListNotesInput,
  NoteDetail,
  NotebookSummary,
  NoteSummary,
  RestoreBackupResult,
  SaveImageAttachmentInput,
  SearchNoteResult,
  SearchNotesInput,
  TrashedNoteSummary,
  UpdateNotebookPatch,
  UpdateNotePatch
} from '@qiushi-notes/shared'

export interface QiushiApi {
  app: {
    getName: () => string
  }
  backups: {
    create: () => Promise<BackupResult>
    restoreFromFile: () => Promise<RestoreBackupResult>
  }
  attachments: {
    saveImageFromPaste: (input: SaveImageAttachmentInput) => Promise<AttachmentDetail>
  }
  importExport: {
    exportJson: () => Promise<ExportJsonResult>
  }
  notes: {
    list: (input?: ListNotesInput) => Promise<NoteSummary[]>
    listTrashed: () => Promise<TrashedNoteSummary[]>
    get: (id: string) => Promise<NoteDetail | null>
    create: (input?: CreateNoteInput) => Promise<NoteDetail>
    update: (id: string, patch: UpdateNotePatch) => Promise<NoteDetail>
    softDelete: (id: string) => Promise<void>
    restore: (id: string) => Promise<NoteDetail>
  }
  search: {
    query: (input: SearchNotesInput) => Promise<SearchNoteResult[]>
  }
  notebooks: {
    list: () => Promise<NotebookSummary[]>
    ensureDefault: () => Promise<NotebookSummary>
    create: (input?: CreateNotebookInput) => Promise<NotebookSummary>
    update: (id: string, patch: UpdateNotebookPatch) => Promise<NotebookSummary>
  }
}
