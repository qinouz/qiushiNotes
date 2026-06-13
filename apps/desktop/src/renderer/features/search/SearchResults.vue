<script setup lang="ts">
import type { SearchNoteResult } from '@qiushi-notes/shared'
import { FileText, NotebookPen, Table2 } from '@lucide/vue'

defineProps<{
  query: string
  results: SearchNoteResult[]
  isLoading: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  openNote: [id: string]
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
  <section class="search-results" aria-label="搜索结果">
    <div v-if="isLoading" class="tree-hint">正在搜索</div>
    <div v-else-if="errorMessage" class="tree-hint error">{{ errorMessage }}</div>
    <div v-else-if="results.length === 0" class="tree-hint">
      没有找到相关笔记
    </div>

    <template v-else>
      <button
        v-for="result in results"
        :key="result.id"
        class="search-result-item"
        type="button"
        @click="emit('openNote', result.id)"
      >
        <NotebookPen
          v-if="result.contentFormat === 'markdown'"
          class="search-result-icon"
          :size="17"
          :stroke-width="1.8"
        />
        <Table2
          v-else-if="result.contentFormat === 'spreadsheet-json'"
          class="search-result-icon"
          :size="17"
          :stroke-width="1.8"
        />
        <FileText
          v-else
          class="search-result-icon"
          :size="17"
          :stroke-width="1.8"
        />

        <span class="search-result-body">
          <strong>{{ result.title }}</strong>
          <span>{{ result.matchPreview || '无正文摘要' }}</span>
          <small>
            {{ formatUpdatedAt(result.updatedAt) }}
            <template v-if="result.notebookName"> · {{ result.notebookName }}</template>
          </small>
        </span>
      </button>
    </template>
  </section>
</template>
