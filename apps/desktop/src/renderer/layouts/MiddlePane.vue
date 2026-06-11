<script setup lang="ts">
import type { NoteTreeNode } from '@qiushi-notes/shared'
import { FileText, FolderPlus, Search } from '@lucide/vue'
import NoteTree from '../features/notebooks/NoteTree.vue'
import DropdownMenu from '../components/DropdownMenu.vue'
import type { MenuItem } from '../components/DropdownMenu.vue'

defineProps<{
  nodes: NoteTreeNode[]
  selectedNodeId: string | null
  searchQuery: string
  isLoading: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  selectNotebook: [id: string]
  toggleNotebook: [id: string]
  selectNote: [id: string]
  createNotebook: [parentId?: string | null]
  renameNotebook: [id: string, name: string]
  createNote: [type: string]
  createNoteInNotebook: [notebookId: string, type: string]
  'update:searchQuery': [value: string]
}>()

const newNoteMenuItems: MenuItem[] = [
  { id: 'note', icon: FileText, label: '普通笔记', shortcut: 'Ctrl+N' },
  { id: 'folder', icon: FolderPlus, label: '文件夹' }
]

function handleMenuSelect(id: string): void {
  if (id === 'folder') {
    emit('createNotebook')
  } else {
    emit('createNote', id)
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
      <NoteTree
        :nodes="nodes"
        :selected-node-id="selectedNodeId"
        :is-loading="isLoading"
        :error-message="errorMessage"
        @select-notebook="emit('selectNotebook', $event)"
        @toggle-notebook="emit('toggleNotebook', $event)"
        @select-note="emit('selectNote', $event)"
        @create-notebook="emit('createNotebook', $event)"
        @rename-notebook="(id, name) => emit('renameNotebook', id, name)"
        @create-note-in-notebook="(notebookId, type) => emit('createNoteInNotebook', notebookId, type)"
      />
    </div>
  </div>
</template>
