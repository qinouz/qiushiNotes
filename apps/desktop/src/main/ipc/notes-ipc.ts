import { ipcMain } from 'electron'
import type { CreateNoteInput, ListNotesInput, UpdateNotePatch } from '@qiushi-notes/shared'
import {
  createNote,
  getNote,
  listNotes,
  listTrashedNotes,
  restoreNote,
  softDeleteNote,
  updateNote
} from '../services/note-service'

export function registerNotesIpcHandlers(): void {
  // IPC 是 renderer 和 main 的边界。
  // 这里不写 SQL，只把请求转交给 service，避免通信层和业务规则混在一起。
  ipcMain.handle('notes:list', (_event, input?: ListNotesInput) => listNotes(input))

  ipcMain.handle('notes:list-trashed', () => listTrashedNotes())

  ipcMain.handle('notes:get', (_event, id: string) => getNote(id))

  ipcMain.handle('notes:create', (_event, input?: CreateNoteInput) => createNote(input))

  ipcMain.handle('notes:update', (_event, id: string, patch: UpdateNotePatch) => updateNote(id, patch))

  ipcMain.handle('notes:soft-delete', (_event, id: string) => {
    softDeleteNote(id)
  })

  ipcMain.handle('notes:restore', (_event, id: string) => restoreNote(id))
}
