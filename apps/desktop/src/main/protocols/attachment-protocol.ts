import fs from 'node:fs'
import { protocol } from 'electron'
import { getAttachmentFile } from '../services/attachment-service'

export const ATTACHMENT_PROTOCOL_SCHEME = 'qiushi-attachment'

export function registerAttachmentProtocolScheme(): void {
  // 自定义协议必须在 app ready 之前注册为标准安全协议，否则 Chromium 可能拒绝把它当作图片资源加载。
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ATTACHMENT_PROTOCOL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true
      }
    }
  ])
}

export function registerAttachmentProtocolHandler(): void {
  protocol.handle(ATTACHMENT_PROTOCOL_SCHEME, (request) => {
    const attachmentId = getAttachmentIdFromUrl(request.url)
    const attachmentFile = attachmentId ? getAttachmentFile(attachmentId) : null

    if (!attachmentFile) {
      return new Response('附件不存在或本地文件丢失。', { status: 404 })
    }

    return new Response(fs.readFileSync(attachmentFile.filePath), {
      headers: {
        'content-type': attachmentFile.mimeType,
        'cache-control': 'no-store'
      }
    })
  })
}

function getAttachmentIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value)
    const rawId = url.hostname || url.pathname.replace(/^\/+/, '')
    return rawId ? decodeURIComponent(rawId) : null
  } catch {
    return null
  }
}
