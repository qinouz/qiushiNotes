<script setup lang="ts">
import type { NotebookSummary } from '@qiushi-notes/shared'

defineProps<{
  appName: string
  notebooks: NotebookSummary[]
  selectedNotebookId: string | null
  isLoading: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  selectAll: []
  selectNotebook: [id: string]
}>()
</script>

<template>
  <aside class="notebook-pane" aria-label="笔记本">
    <header class="pane-header">
      <span class="app-title">{{ appName }}</span>
    </header>

    <nav class="notebook-list" aria-label="笔记本导航">
      <button
        class="notebook-item"
        :class="{ active: selectedNotebookId === null }"
        type="button"
        @click="emit('selectAll')"
      >
        全部笔记
      </button>

      <div class="notebook-section-title">笔记本</div>
      <div v-if="isLoading" class="notebook-hint">正在加载</div>
      <div v-else-if="errorMessage" class="notebook-hint error">{{ errorMessage }}</div>
      <template v-else>
        <button
          v-for="notebook in notebooks"
          :key="notebook.id"
          class="notebook-item child"
          :class="{ active: selectedNotebookId === notebook.id }"
          type="button"
          @click="emit('selectNotebook', notebook.id)"
        >
          {{ notebook.name }}
        </button>
      </template>

      <button class="notebook-item" type="button">回收站</button>
    </nav>
  </aside>
</template>
