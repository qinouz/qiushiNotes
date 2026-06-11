<script setup lang="ts">
import type { NotebookTreeRow } from './useNotebooks'

defineProps<{
  appName: string
  notebooks: NotebookTreeRow[]
  selectedNotebookId: string | null
  isLoading: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  selectAll: []
  selectNotebook: [id: string]
  createNotebook: [parentId?: string | null]
  renameNotebook: [id: string, name: string]
}>()

function requestRename(id: string, currentName: string): void {
  const nextName = window.prompt('重命名笔记本', currentName)

  if (nextName === null) {
    return
  }

  emit('renameNotebook', id, nextName)
}
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

      <div class="notebook-section-title split">
        <span>笔记本</span>
        <button
          class="mini-icon-button"
          type="button"
          aria-label="新建笔记本"
          title="新建笔记本"
          @click="emit('createNotebook', null)"
        >
          +
        </button>
      </div>
      <div v-if="isLoading" class="notebook-hint">正在加载</div>
      <div v-else-if="errorMessage" class="notebook-hint error">{{ errorMessage }}</div>
      <template v-else>
        <div
          v-for="notebook in notebooks"
          :key="notebook.id"
          class="notebook-row"
          :style="{ paddingLeft: `${12 + notebook.depth * 16}px` }"
        >
          <button
            class="notebook-item child"
            :class="{ active: selectedNotebookId === notebook.id }"
            type="button"
            @click="emit('selectNotebook', notebook.id)"
          >
            {{ notebook.name }}
          </button>
          <button
            class="mini-icon-button"
            type="button"
            :aria-label="`在 ${notebook.name} 下新建子笔记本`"
            title="新建子笔记本"
            @click="emit('createNotebook', notebook.id)"
          >
            +
          </button>
          <button
            class="mini-icon-button"
            type="button"
            :aria-label="`重命名 ${notebook.name}`"
            title="重命名"
            @click="requestRename(notebook.id, notebook.name)"
          >
            ...
          </button>
        </div>
      </template>

      <button class="notebook-item" type="button">回收站</button>
    </nav>
  </aside>
</template>
