<script setup lang="ts">
import type { NoteSummary } from '@qiushi-notes/shared'
import { FileText, NotebookPen, Table2 } from '@lucide/vue'

defineProps<{
  notes: NoteSummary[]
  selectedNoteId: string | null
  isLoading: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
}>()
</script>

<template>
  <div class="note-list-container">
    <div v-if="isLoading" class="note-empty">正在加载</div>
    <div v-else-if="notes.length === 0" class="note-empty">暂无笔记</div>
    <div v-else class="note-list">
      <button
        v-for="note in notes"
        :key="note.id"
        class="note-card"
        :class="{ active: selectedNoteId === note.id }"
        type="button"
        @click="emit('select', note.id)"
      >
        <NotebookPen
          v-if="note.contentFormat === 'markdown'"
          class="note-icon"
          :size="16"
          :stroke-width="1.8"
        />
        <Table2
          v-else-if="note.contentFormat === 'spreadsheet-json'"
          class="note-icon"
          :size="16"
          :stroke-width="1.8"
        />
        <FileText v-else class="note-icon" :size="16" :stroke-width="1.8" />
        <div class="note-info">
          <span class="note-title">{{ note.title }}</span>
          <span class="note-preview">{{ note.contentPreview || ' ' }}</span>
        </div>
      </button>
    </div>
  </div>
</template>
