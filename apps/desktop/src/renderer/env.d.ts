import type { QiushiApi } from '../preload/api'

declare global {
  interface Window {
    qiushi: QiushiApi
    __qiushiSpreadsheetSmoke?: {
      noteId: string
      setCellValue: (row: number, column: number, value: string | number | boolean) => string
      flush: () => string
      getSerializedContent: () => string
    }
  }
}

export {}
