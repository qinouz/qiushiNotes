<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import NoteEditor from '../features/notes/NoteEditor.vue'
import FolderContentView from '../features/notebooks/FolderContentView.vue'
import SettingsView from '../features/settings/SettingsView.vue'
import TrashView from '../features/trash/TrashView.vue'
import { useNoteTree } from '../features/notebooks/useNoteTree'
import FunctionBar from './FunctionBar.vue'
import MiddlePane from './MiddlePane.vue'
import type { NoteDetail } from '@qiushi-notes/shared'

const activeView = ref('notes')

const {
  treeNodes,
  selectedNote,
  selectedNodeId,
  selectedNotebook,
  selectedNotebookPath,
  folderContentItems,
  searchQuery,
  searchResults,
  isLoading,
  isSearchLoading,
  errorMessage,
  searchErrorMessage,
  draftTitle,
  draftContent,
  isSaving,
  saveStatus,
  loadTree,
  upgradeDraftContentFormat,
  selectNode,
  toggleNotebook,
  createNotebook,
  renameNotebook,
  renameNote,
  createNote,
  createNoteInNotebook,
  deleteNote,
  deleteCurrentNote
} = useNoteTree()

function handleKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
    event.preventDefault()
    void createNote('note')
  }
}

function handleNoteRestored(note: NoteDetail): void {
  void loadTree(note.id)
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

    <SettingsView v-if="activeView === 'settings'" />
    <TrashView v-else-if="activeView === 'trash'" @restored="handleNoteRestored" />

    <template v-else>
      <MiddlePane
      :nodes="treeNodes"
      :selected-node-id="selectedNodeId"
      v-model:search-query="searchQuery"
      :search-results="searchResults"
      :is-loading="isLoading"
      :is-search-loading="isSearchLoading"
      :error-message="errorMessage"
      :search-error-message="searchErrorMessage"
      @select-notebook="selectNode"
      @toggle-notebook="toggleNotebook"
      @select-note="selectNode"
      @create-notebook="createNotebook"
      @rename-notebook="(id, name) => renameNotebook(id, name)"
      @rename-note="(id, title) => renameNote(id, title)"
      @delete-note="deleteNote"
      @create-note="createNote"
      @create-note-in-notebook="(notebookId, type) => createNoteInNotebook(notebookId, type)"
      />

      <NoteEditor
        v-if="selectedNote"
        v-model:title="draftTitle"
        v-model:content="draftContent"
        :selected-note="selectedNote"
        :is-saving="isSaving"
        :save-status="saveStatus"
        :error-message="errorMessage"
        @upgrade-content-format="upgradeDraftContentFormat"
        @delete="deleteCurrentNote"
      />
      <FolderContentView
        v-else
        :notebook="selectedNotebook"
        :path="selectedNotebookPath"
        :items="folderContentItems"
        @open-notebook="selectNode"
        @open-note="selectNode"
        @create-note="createNote"
        @create-notebook="createNotebook"
      />
    </template>
  </main>
</template>
