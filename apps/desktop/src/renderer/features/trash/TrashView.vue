<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { NoteDetail, TrashedNoteSummary } from '@qiushi-notes/shared'
import { FileText, RotateCcw, Trash2 } from '@lucide/vue'

const emit = defineEmits<{
  restored: [note: NoteDetail]
}>()

const trashedNotes = ref<TrashedNoteSummary[]>([])
const isLoading = ref(false)
const restoringNoteId = ref<string | null>(null)
const errorMessage = ref('')
const statusMessage = ref('')

onMounted(() => {
  void loadTrashedNotes()
})

async function loadTrashedNotes(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  statusMessage.value = ''

  try {
    trashedNotes.value = await window.qiushi.notes.listTrashed()
  } catch (error) {
    errorMessage.value = getErrorMessage(error, '回收站加载失败')
  } finally {
    isLoading.value = false
  }
}

async function restoreNote(note: TrashedNoteSummary): Promise<void> {
  restoringNoteId.value = note.id
  errorMessage.value = ''
  statusMessage.value = ''

  try {
    const restored = await window.qiushi.notes.restore(note.id)
    trashedNotes.value = trashedNotes.value.filter((item) => item.id !== note.id)
    statusMessage.value = `已恢复“${restored.title}”。`
    emit('restored', restored)
  } catch (error) {
    errorMessage.value = getErrorMessage(error, '恢复失败')
  } finally {
    restoringNoteId.value = null
  }
}

function formatDateTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
</script>

<template>
  <section class="trash-view" aria-label="回收站">
    <header class="trash-header">
      <div class="trash-title-row">
        <Trash2 :size="22" :stroke-width="1.9" />
        <div>
          <h1>回收站</h1>
          <p>已删除的笔记会先保留在本地，恢复前不会物理清理正文和附件。</p>
        </div>
      </div>

      <button class="text-button" type="button" :disabled="isLoading" @click="loadTrashedNotes">
        刷新
      </button>
    </header>

    <p v-if="statusMessage" class="trash-status">{{ statusMessage }}</p>
    <p v-if="errorMessage" class="trash-status error">{{ errorMessage }}</p>

    <div v-if="isLoading" class="trash-empty">正在加载回收站</div>
    <div v-else-if="trashedNotes.length === 0" class="trash-empty">回收站为空</div>

    <ul v-else class="trash-list">
      <li v-for="note in trashedNotes" :key="note.id" class="trash-list-item">
        <div class="trash-note-main">
          <FileText class="trash-note-icon" :size="18" :stroke-width="1.8" />
          <div class="trash-note-copy">
            <strong>{{ note.title }}</strong>
            <span>{{ note.contentPreview || '无正文摘要' }}</span>
            <small>
              删除于 {{ formatDateTime(note.deletedAt) }}
              <template v-if="note.notebookName"> · 原文件夹：{{ note.notebookName }}</template>
            </small>
          </div>
        </div>

        <button
          class="settings-action-button"
          type="button"
          :disabled="restoringNoteId === note.id"
          @click="restoreNote(note)"
        >
          <RotateCcw :size="16" :stroke-width="2" />
          恢复
        </button>
      </li>
    </ul>
  </section>
</template>
