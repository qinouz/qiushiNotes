<script setup lang="ts">
import type { NoteTreeNode } from '@qiushi-notes/shared'
import { ChevronRight, FileText, Folder, FolderOpen, FolderPlus, NotebookPen, Pencil } from '@lucide/vue'
import DropdownMenu from '../../components/DropdownMenu.vue'
import type { MenuItem } from '../../components/DropdownMenu.vue'

const props = defineProps<{
  nodes: NoteTreeNode[]
  selectedNodeId: string | null
  isLoading: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  selectNotebook: [id: string]
  toggleNotebook: [id: string]
  selectNote: [id: string]
  createNoteInNotebook: [notebookId: string, type: 'note' | 'markdown']
  createNotebook: [parentId?: string | null]
  renameNotebook: [id: string, name: string]
}>()

const newMenuItems: MenuItem[] = [
  { id: 'note', icon: FileText, label: '普通笔记' },
  { id: 'markdown', icon: NotebookPen, label: 'Markdown 笔记' },
  { id: 'folder', icon: FolderPlus, label: '文件夹' },
  { id: 'rename', icon: Pencil, label: '重命名' }
]

function handleNodeClick(node: NoteTreeNode): void {
  if (node.type === 'notebook') {
    emit('selectNotebook', node.id)
  } else {
    emit('selectNote', node.id)
  }
}

function handleMenuSelect(notebookId: string, menuId: string): void {
  if (menuId === 'rename') {
    requestRename(notebookId)
  } else if (menuId === 'folder') {
    emit('createNotebook', notebookId)
  } else {
    emit('createNoteInNotebook', notebookId, menuId === 'markdown' ? 'markdown' : 'note')
  }
}

function requestRename(notebookId: string): void {
  const node = findNotebookNode(notebookId)
  const nextName = window.prompt('重命名文件夹', node?.name ?? '')

  if (nextName === null) {
    return
  }

  emit('renameNotebook', notebookId, nextName)
}

function findNotebookNode(id: string): NoteTreeNode | undefined {
  return props.nodes.find((node) => node.type === 'notebook' && node.id === id)
}
</script>

<template>
  <nav class="note-tree" aria-label="笔记导航">
    <div v-if="isLoading" class="tree-hint">正在加载</div>
    <div v-else-if="errorMessage" class="tree-hint error">{{ errorMessage }}</div>
    <template v-else>
      <div
        v-for="node in nodes"
        :key="node.id"
        class="tree-node"
        :class="{
          notebook: node.type === 'notebook',
          note: node.type === 'note',
          selected: selectedNodeId === node.id
        }"
        :style="{ paddingLeft: `${8 + node.depth * 16}px` }"
      >
        <button
          v-if="node.type === 'notebook'"
          class="tree-toggle-button"
          type="button"
          :aria-label="node.isExpanded ? '折叠文件夹' : '展开文件夹'"
          @click.stop="emit('toggleNotebook', node.id)"
        >
          <ChevronRight class="tree-arrow" :class="{ expanded: node.isExpanded }" :size="14" />
        </button>
        <span v-else class="tree-toggle-spacer"></span>

        <button
          class="tree-node-button"
          type="button"
          @click="handleNodeClick(node)"
        >
          <FolderOpen
            v-if="node.type === 'notebook' && node.isExpanded"
            class="tree-node-icon"
            :size="16"
            :stroke-width="1.8"
          />
          <Folder
            v-else-if="node.type === 'notebook'"
            class="tree-node-icon"
            :size="16"
            :stroke-width="1.8"
          />
          <NotebookPen
            v-else-if="node.contentFormat === 'markdown'"
            class="tree-node-icon"
            :size="16"
            :stroke-width="1.8"
          />
          <FileText
            v-else
            class="tree-node-icon"
            :size="16"
            :stroke-width="1.8"
          />
          <span class="tree-node-label">{{ node.name }}</span>
        </button>

        <template v-if="node.type === 'notebook'">
          <div class="tree-node-actions">
            <DropdownMenu
              :items="newMenuItems"
              trigger-label="新建"
              :trigger-title="`在 ${node.name} 下新建`"
              @select="(id) => handleMenuSelect(node.id, id)"
            />
          </div>
        </template>
      </div>
    </template>
  </nav>
</template>
