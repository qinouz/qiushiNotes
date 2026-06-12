<script setup lang="ts">
import type { NoteTreeNode } from '@qiushi-notes/shared'
import {
  ChevronRight,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  NotebookPen,
  Pencil,
  Trash2
} from '@lucide/vue'
import { ref } from 'vue'
import ContextMenu from '../../components/ContextMenu.vue'
import type { ContextMenuItem } from '../../components/ContextMenu.vue'
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
  renameNote: [id: string, title: string]
  deleteNote: [id: string]
}>()

const newMenuItems: MenuItem[] = [
  { id: 'note', icon: FileText, label: '普通笔记' },
  { id: 'markdown', icon: NotebookPen, label: 'Markdown 笔记' },
  { id: 'folder', icon: FolderPlus, label: '文件夹' },
  { id: 'rename', icon: Pencil, label: '重命名' }
]

const notebookContextMenuItems: ContextMenuItem[] = [
  { id: 'note', icon: FileText, label: '新建普通笔记' },
  { id: 'markdown', icon: NotebookPen, label: '新建 Markdown' },
  { id: 'folder', icon: FolderPlus, label: '新建文件夹' },
  { id: 'rename', icon: Pencil, label: '重命名' }
]

const noteContextMenuItems: ContextMenuItem[] = [
  { id: 'open', icon: ExternalLink, label: '打开' },
  { id: 'rename', icon: Pencil, label: '重命名' },
  { id: 'delete', icon: Trash2, label: '删除', danger: true }
]

const contextMenu = ref<{
  node: NoteTreeNode
  x: number
  y: number
} | null>(null)

function handleNodeClick(node: NoteTreeNode): void {
  if (node.type === 'notebook') {
    emit('selectNotebook', node.id)
  } else {
    emit('selectNote', node.id)
  }
}

function handleNodeContextMenu(event: MouseEvent, node: NoteTreeNode): void {
  contextMenu.value = {
    node,
    x: Math.min(event.clientX, window.innerWidth - 220),
    y: Math.min(event.clientY, window.innerHeight - 180)
  }
}

function closeContextMenu(): void {
  contextMenu.value = null
}

function handleMenuSelect(notebookId: string, menuId: string): void {
  if (menuId === 'rename') {
    requestRenameNotebook(notebookId)
  } else if (menuId === 'folder') {
    emit('createNotebook', notebookId)
  } else {
    emit('createNoteInNotebook', notebookId, menuId === 'markdown' ? 'markdown' : 'note')
  }
}

function handleContextMenuSelect(menuId: string): void {
  const node = contextMenu.value?.node

  if (!node) {
    return
  }

  if (node.type === 'notebook') {
    handleMenuSelect(node.id, menuId)
    return
  }

  if (menuId === 'open') {
    emit('selectNote', node.id)
  } else if (menuId === 'rename') {
    requestRenameNote(node)
  } else if (menuId === 'delete') {
    requestDeleteNote(node)
  }
}

function requestRenameNotebook(notebookId: string): void {
  const node = findNotebookNode(notebookId)
  const nextName = window.prompt('重命名文件夹', node?.name ?? '')

  if (nextName === null) {
    return
  }

  emit('renameNotebook', notebookId, nextName)
}

function requestRenameNote(node: NoteTreeNode): void {
  const nextTitle = window.prompt('重命名笔记', node.name)

  if (nextTitle === null) {
    return
  }

  emit('renameNote', node.id, nextTitle)
}

function requestDeleteNote(node: NoteTreeNode): void {
  const confirmed = window.confirm(`删除笔记“${node.name}”？\n\n删除后会进入回收站，后续可从回收站恢复。`)

  if (!confirmed) {
    return
  }

  emit('deleteNote', node.id)
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
        @contextmenu.stop.prevent="handleNodeContextMenu($event, node)"
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

    <ContextMenu
      v-if="contextMenu"
      :items="contextMenu.node.type === 'notebook' ? notebookContextMenuItems : noteContextMenuItems"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @select="handleContextMenuSelect"
      @close="closeContextMenu"
    />
  </nav>
</template>
