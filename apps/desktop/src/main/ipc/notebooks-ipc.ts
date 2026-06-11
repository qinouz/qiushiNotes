import { ipcMain } from 'electron'
import type { CreateNotebookInput, UpdateNotebookPatch } from '@qiushi-notes/shared'
import {
  createNotebook,
  ensureDefaultNotebook,
  listNotebooks,
  updateNotebook
} from '../services/notebook-service'

export function registerNotebooksIpcHandlers(): void {
  ipcMain.handle('notebooks:list', () => listNotebooks())
  ipcMain.handle('notebooks:ensure-default', () => ensureDefaultNotebook())
  ipcMain.handle('notebooks:create', (_event, input?: CreateNotebookInput) => createNotebook(input))
  ipcMain.handle('notebooks:update', (_event, id: string, patch: UpdateNotebookPatch) =>
    updateNotebook(id, patch)
  )
}
