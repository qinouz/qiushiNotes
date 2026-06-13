import { contextBridge, ipcRenderer } from 'electron'
import type { QiushiApi } from './api'

const api: QiushiApi = {
  app: {
    getName: () => '秋实笔记'
  },
  backups: {
    create: () => ipcRenderer.invoke('backups:create'),
    restoreFromFile: () => ipcRenderer.invoke('backups:restore-from-file')
  },
  attachments: {
    saveImageFromPaste: (input) => ipcRenderer.invoke('attachments:save-image-from-paste', input)
  },
  notes: {
    // preload 只暴露业务语义，不暴露原始 ipcRenderer。
    // 这样 Vue 页面无法随意调用本地能力，Electron 安全边界更清晰。
    list: (input) => ipcRenderer.invoke('notes:list', input),
    get: (id) => ipcRenderer.invoke('notes:get', id),
    create: (input) => ipcRenderer.invoke('notes:create', input),
    update: (id, patch) => ipcRenderer.invoke('notes:update', id, patch),
    softDelete: (id) => ipcRenderer.invoke('notes:soft-delete', id)
  },
  notebooks: {
    list: () => ipcRenderer.invoke('notebooks:list'),
    ensureDefault: () => ipcRenderer.invoke('notebooks:ensure-default'),
    create: (input) => ipcRenderer.invoke('notebooks:create', input),
    update: (id, patch) => ipcRenderer.invoke('notebooks:update', id, patch)
  }
}

contextBridge.exposeInMainWorld('qiushi', api)
