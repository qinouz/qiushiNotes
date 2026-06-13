import { dialog, ipcMain, BrowserWindow, type OpenDialogOptions } from 'electron'
import { createBackup, restoreBackupFromFile } from '../services/backup-service'
import type { RestoreBackupResult } from '@qiushi-notes/shared'

export function registerBackupsIpcHandlers(): void {
  ipcMain.handle('backups:create', () => createBackup())
  ipcMain.handle('backups:restore-from-file', async (event): Promise<RestoreBackupResult> => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options: OpenDialogOptions = {
      title: '选择秋实笔记备份文件',
      properties: ['openFile'],
      filters: [
        { name: '秋实笔记备份', extensions: ['gz'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    }
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || !result.filePaths[0]) {
      return {
        restored: false,
        cancelled: true
      }
    }

    return restoreBackupFromFile(result.filePaths[0])
  })
}
