<script setup lang="ts">
import type { NotebookSummary } from '@qiushi-notes/shared'
import { FileText, Folder, FolderPlus, NotebookPen, Plus, Table2 } from '@lucide/vue'
import type { FolderContentItem } from './useNoteTree'

defineProps<{
  notebook: NotebookSummary | null
  path: NotebookSummary[]
  items: FolderContentItem[]
}>()

const emit = defineEmits<{
  openNotebook: [id: string]
  openNote: [id: string]
  createNote: [kind: 'note' | 'markdown' | 'spreadsheet']
  createNotebook: []
}>()

function formatUpdatedAt(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}
</script>

<template>
  <section class="folder-content-view" aria-label="文件夹内容">
    <header class="folder-content-header">
      <nav class="folder-breadcrumb" aria-label="当前位置">
        <span>全部笔记</span>
        <template v-for="node in path" :key="node.id">
          <span class="breadcrumb-separator">/</span>
          <span>{{ node.name }}</span>
        </template>
      </nav>

      <div class="folder-title-row">
        <div class="folder-title-block">
          <h1 class="folder-title">{{ notebook?.name ?? '全部笔记' }}</h1>
          <span class="folder-count">{{ items.length }} 项内容</span>
        </div>

        <div class="folder-actions">
          <button class="text-button" type="button" @click="emit('createNote', 'note')">
            <Plus :size="15" :stroke-width="2" />
            普通笔记
          </button>
          <button class="text-button" type="button" @click="emit('createNote', 'markdown')">
            <NotebookPen :size="15" :stroke-width="2" />
            Markdown
          </button>
          <button class="text-button" type="button" @click="emit('createNote', 'spreadsheet')">
            <Table2 :size="15" :stroke-width="2" />
            表格笔记
          </button>
          <button class="text-button" type="button" @click="emit('createNotebook')">
            <FolderPlus :size="15" :stroke-width="2" />
            文件夹
          </button>
        </div>
      </div>
    </header>

    <div v-if="items.length === 0" class="folder-empty">
      <p>当前文件夹还没有内容</p>
      <div class="folder-empty-actions">
        <button class="text-button" type="button" @click="emit('createNote', 'note')">新建笔记</button>
        <button class="text-button" type="button" @click="emit('createNote', 'markdown')">
          新建 Markdown
        </button>
        <button class="text-button" type="button" @click="emit('createNote', 'spreadsheet')">
          新建表格笔记
        </button>
        <button class="text-button" type="button" @click="emit('createNotebook')">新建文件夹</button>
      </div>
    </div>

    <div v-else class="folder-card-grid">
      <button
        v-for="item in items"
        :key="`${item.type}:${item.id}`"
        class="folder-card"
        type="button"
        @click="item.type === 'notebook' ? emit('openNotebook', item.id) : emit('openNote', item.id)"
      >
        <Folder
          v-if="item.type === 'notebook'"
          class="folder-card-icon"
          :size="18"
          :stroke-width="1.8"
        />
        <NotebookPen
          v-else-if="item.contentFormat === 'markdown'"
          class="folder-card-icon"
          :size="18"
          :stroke-width="1.8"
        />
        <Table2
          v-else-if="item.contentFormat === 'spreadsheet-json'"
          class="folder-card-icon"
          :size="18"
          :stroke-width="1.8"
        />
        <FileText
          v-else
          class="folder-card-icon"
          :size="18"
          :stroke-width="1.8"
        />
        <div class="folder-card-body">
          <div class="folder-card-title-row">
            <span class="folder-card-title">{{ item.title }}</span>
            <span class="folder-card-type">
              {{
                item.type === 'notebook'
                  ? '文件夹'
                  : item.contentFormat === 'markdown'
                    ? 'Markdown'
                    : item.contentFormat === 'spreadsheet-json'
                      ? '表格'
                      : '笔记'
              }}
            </span>
          </div>
          <span v-if="item.type === 'note'" class="folder-card-preview">
            {{ item.contentPreview || ' ' }}
          </span>
          <span class="folder-card-time">{{ formatUpdatedAt(item.updatedAt) }}</span>
        </div>
      </button>
    </div>
  </section>
</template>
