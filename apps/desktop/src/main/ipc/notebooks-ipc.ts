import { ipcMain } from 'electron'
import { ensureDefaultNotebook, listNotebooks } from '../services/notebook-service'

export function registerNotebooksIpcHandlers(): void {
  ipcMain.handle('notebooks:list', () => listNotebooks())
  ipcMain.handle('notebooks:ensure-default', () => ensureDefaultNotebook())
}

