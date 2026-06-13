<script setup lang="ts">
import type { NoteTreeNode, SearchNoteResult } from '@qiushi-notes/shared'
import { FileText, FolderPlus, NotebookPen, Search, Table2 } from '@lucide/vue'
import NoteTree from '../features/notebooks/NoteTree.vue'
import SearchResults from '../features/search/SearchResults.vue'
import DropdownMenu from '../components/DropdownMenu.vue'
import type { MenuItem } from '../components/DropdownMenu.vue'

defineProps<{
  nodes: NoteTreeNode[]
  selectedNodeId: string | null
  searchQuery: string
  searchResults: SearchNoteResult[]
  isLoading: boolean
  isSearchLoading: boolean
  errorMessage: string
  searchErrorMessage: string
}>()

const emit = defineEmits<{
  selectNotebook: [id: string]
  toggleNotebook: [id: string]
  selectNote: [id: string]
  createNotebook: [parentId?: string | null]
  renameNotebook: [id: string, name: string]
  renameNote: [id: string, title: string]
  deleteNote: [id: string]
  createNote: [type: 'note' | 'markdown' | 'spreadsheet']
  createNoteInNotebook: [notebookId: string, type: 'note' | 'markdown' | 'spreadsheet']
  'update:searchQuery': [value: string]
}>()

const newNoteMenuItems: MenuItem[] = [
  { id: 'note', icon: FileText, label: '普通笔记', shortcut: 'Ctrl+N' },
  { id: 'markdown', icon: NotebookPen, label: 'Markdown 笔记' },
  { id: 'spreadsheet', icon: Table2, label: '表格笔记' },
  { id: 'folder', icon: FolderPlus, label: '文件夹' }
]

function handleMenuSelect(id: string): void {
  if (id === 'folder') {
    emit('createNotebook')
  } else {
    emit('createNote', id === 'markdown' ? 'markdown' : id === 'spreadsheet' ? 'spreadsheet' : 'note')
  }
}

function handleSearchInput(event: Event): void {
  emit('update:searchQuery', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="middle-pane">
    <header class="middle-pane-header">
      <label class="search-box" aria-label="搜索">
        <Search class="search-icon" :size="16" :stroke-width="1.8" />
        <input
          class="search-input"
          type="search"
          :value="searchQuery"
          placeholder="搜索"
          spellcheck="false"
          @input="handleSearchInput"
        />
      </label>

      <div class="middle-pane-actions">
        <DropdownMenu
          :items="newNoteMenuItems"
          trigger-label="新建"
          trigger-title="新建 (Ctrl+N)"
          trigger-variant="primary"
          @select="handleMenuSelect"
        />
      </div>
    </header>

    <div class="middle-pane-body">
      <SearchResults
        v-if="searchQuery.trim()"
        :query="searchQuery"
        :results="searchResults"
        :is-loading="isSearchLoading"
        :error-message="searchErrorMessage"
        @open-note="emit('selectNote', $event)"
      />
      <NoteTree
        v-else
        :nodes="nodes"
        :selected-node-id="selectedNodeId"
        :is-loading="isLoading"
        :error-message="errorMessage"
        @select-notebook="emit('selectNotebook', $event)"
        @toggle-notebook="emit('toggleNotebook', $event)"
        @select-note="emit('selectNote', $event)"
        @create-notebook="emit('createNotebook', $event)"
        @rename-notebook="(id, name) => emit('renameNotebook', id, name)"
        @rename-note="(id, title) => emit('renameNote', id, title)"
        @delete-note="emit('deleteNote', $event)"
        @create-note-in-notebook="(notebookId, type) => emit('createNoteInNotebook', notebookId, type)"
      />
    </div>
  </div>
</template>
