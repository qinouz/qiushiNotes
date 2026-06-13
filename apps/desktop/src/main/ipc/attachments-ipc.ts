import { ipcMain } from 'electron'
import type { SaveImageAttachmentInput } from '@qiushi-notes/shared'
import { saveImageAttachment } from '../services/attachment-service'

export function registerAttachmentsIpcHandlers(): void {
  ipcMain.handle('attachments:save-image-from-paste', (_event, input: SaveImageAttachmentInput) =>
    saveImageAttachment(input)
  )
}
