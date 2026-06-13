import { ipcMain } from 'electron'
import { exportJsonPackage } from '../services/import-export-service'

export function registerImportExportIpcHandlers(): void {
  ipcMain.handle('import-export:export-json', () => exportJsonPackage())
}
