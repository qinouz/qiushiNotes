import type { QiushiApi } from '../preload/api'

declare global {
  interface Window {
    qiushi: QiushiApi
  }
}

export {}
