<script setup lang="ts">
import NoteEditor from '../features/notes/NoteEditor.vue'
import NoteList from '../features/notes/NoteList.vue'
import { useNotes } from '../features/notes/useNotes'
import NotebookSidebar from '../features/notebooks/NotebookSidebar.vue'
import { useNotebooks } from '../features/notebooks/useNotebooks'
import { watch } from 'vue'

const appName = window.qiushi.app.getName()

const {
  notebooks,
  selectedNotebookId,
  selectedNotebookName,
  defaultNotebookId,
  isLoadingNotebooks,
  notebookError,
  selectAllNotes,
  selectNotebook
} = useNotebooks()

const {
  notes,
  selectedNote,
  draftTitle,
  draftContent,
  isLoading,
  isSaving,
  saveStatus,
  errorMessage,
  setActiveNotebook,
  setDefaultNotebook,
  selectNote,
  createNote,
  deleteCurrentNote
} = useNotes()

watch(selectedNotebookId, (notebookId) => {
  void setActiveNotebook(notebookId)
})

watch(defaultNotebookId, (notebookId) => {
  setDefaultNotebook(notebookId)
})
</script>

<template>
  <main class="app-shell">
    <NotebookSidebar
      :app-name="appName"
      :notebooks="notebooks"
      :selected-notebook-id="selectedNotebookId"
      :is-loading="isLoadingNotebooks"
      :error-message="notebookError"
      @select-all="selectAllNotes"
      @select-notebook="selectNotebook"
    />

    <NoteList
      :title="selectedNotebookName"
      :notes="notes"
      :selected-note-id="selectedNote?.id ?? null"
      :is-loading="isLoading"
      @create="createNote"
      @select="selectNote"
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
