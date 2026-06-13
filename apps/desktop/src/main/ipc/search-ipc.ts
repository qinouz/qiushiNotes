import { ipcMain } from 'electron'
import type { SearchNotesInput } from '@qiushi-notes/shared'
import { searchNotes } from '../services/search-service'

export function registerSearchIpcHandlers(): void {
  ipcMain.handle('search:query', (_event, input: SearchNotesInput) => searchNotes(input))
}
