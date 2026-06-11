import { computed, onMounted, ref } from 'vue'
import type { NotebookSummary } from '@qiushi-notes/shared'

export interface NotebookTreeRow extends NotebookSummary {
  depth: number
}

export function useNotebooks() {
  const notebooks = ref<NotebookSummary[]>([])
  const selectedNotebookId = ref<string | null>(null)
  const defaultNotebookId = ref<string | null>(null)
  const isLoadingNotebooks = ref(false)
  const notebookError = ref('')

  const selectedNotebookName = computed(() => {
    if (!selectedNotebookId.value) {
      return '全部笔记'
    }

    return notebooks.value.find((notebook) => notebook.id === selectedNotebookId.value)?.name ?? '未知笔记本'
  })

  const notebookTreeRows = computed<NotebookTreeRow[]>(() => flattenNotebooks(notebooks.value))

  onMounted(() => {
    void loadNotebooks()
  })

  async function loadNotebooks(): Promise<void> {
    isLoadingNotebooks.value = true
    notebookError.value = ''

    try {
      const defaultNotebook = await window.qiushi.notebooks.ensureDefault()
      defaultNotebookId.value = defaultNotebook.id
      notebooks.value = await window.qiushi.notebooks.list()
    } catch (error) {
      notebookError.value = error instanceof Error ? error.message : '笔记本加载失败'
    } finally {
      isLoadingNotebooks.value = false
    }
  }

  function selectAllNotes(): void {
    selectedNotebookId.value = null
  }

  function selectNotebook(id: string): void {
    selectedNotebookId.value = id
  }

  async function createNotebook(parentId: string | null = null): Promise<void> {
    notebookError.value = ''

    try {
      const created = await window.qiushi.notebooks.create({ parentId })
      notebooks.value = await window.qiushi.notebooks.list()
      selectedNotebookId.value = created.id
    } catch (error) {
      notebookError.value = getErrorMessage(error, '笔记本创建失败')
    }
  }

  async function renameNotebook(id: string, name: string): Promise<void> {
    notebookError.value = ''

    try {
      const updated = await window.qiushi.notebooks.update(id, { name })
      notebooks.value = await window.qiushi.notebooks.list()

      if (selectedNotebookId.value === id) {
        selectedNotebookId.value = updated.id
      }
    } catch (error) {
      notebookError.value = getErrorMessage(error, '笔记本重命名失败')
    }
  }

  return {
    notebooks,
    notebookTreeRows,
    selectedNotebookId,
    selectedNotebookName,
    defaultNotebookId,
    isLoadingNotebooks,
    notebookError,
    loadNotebooks,
    selectAllNotes,
    selectNotebook,
    createNotebook,
    renameNotebook
  }
}

function flattenNotebooks(notebooks: NotebookSummary[]): NotebookTreeRow[] {
  const childrenByParent = new Map<string | null, NotebookSummary[]>()

  for (const notebook of notebooks) {
    const siblings = childrenByParent.get(notebook.parentId) ?? []
    siblings.push(notebook)
    childrenByParent.set(notebook.parentId, siblings)
  }

  const rows: NotebookTreeRow[] = []
  const visited = new Set<string>()

  appendChildren(null, 0)

  for (const notebook of notebooks) {
    if (!visited.has(notebook.id)) {
      appendNotebook(notebook, 0)
    }
  }

  return rows

  function appendChildren(parentId: string | null, depth: number): void {
    for (const child of childrenByParent.get(parentId) ?? []) {
      appendNotebook(child, depth)
    }
  }

  function appendNotebook(notebook: NotebookSummary, depth: number): void {
    if (visited.has(notebook.id)) {
      return
    }

    visited.add(notebook.id)
    rows.push({ ...notebook, depth })
    appendChildren(notebook.id, depth + 1)
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
