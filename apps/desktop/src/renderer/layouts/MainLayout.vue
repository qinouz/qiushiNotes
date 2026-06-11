<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import NoteEditor from '../features/notes/NoteEditor.vue'
import { useNoteTree } from '../features/notebooks/useNoteTree'
import FunctionBar from './FunctionBar.vue'
import MiddlePane from './MiddlePane.vue'

const activeView = ref('notes')

const {
  treeNodes,
  selectedNote,
  selectedNodeId,
  searchQuery,
  isLoading,
  errorMessage,
  draftTitle,
  draftContent,
  isSaving,
  saveStatus,
  selectNode,
  toggleNotebook,
  createNotebook,
  renameNotebook,
  createNote,
  createNoteInNotebook,
  deleteCurrentNote
} = useNoteTree()

function handleKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
    event.preventDefault()
    void createNote('note')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <main class="app-shell">
    <FunctionBar
      :active-view="activeView"
      @navigate="activeView = $event"
    />

    <MiddlePane
      :nodes="treeNodes"
      :selected-node-id="selectedNodeId"
      v-model:search-query="searchQuery"
      :is-loading="isLoading"
      :error-message="errorMessage"
      @select-notebook="selectNode"
      @toggle-notebook="toggleNotebook"
      @select-note="selectNode"
      @create-notebook="createNotebook"
      @rename-notebook="(id, name) => renameNotebook(id, name)"
      @create-note="createNote"
      @create-note-in-notebook="(notebookId, type) => createNoteInNotebook(notebookId, type)"
    />

    <NoteEditor
      v-model:title="draftTitle"
      v-model:content="draftContent"
      :selected-note="selectedNote"
      :is-saving="isSaving"
      :save-status="saveStatus"
      :error-message="errorMessage"
      @delete="deleteCurrentNote"
    />
  </main>
</template>
