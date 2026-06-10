import { computed, onMounted, ref } from 'vue'
import type { NotebookSummary } from '@qiushi-notes/shared'

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

  return {
    notebooks,
    selectedNotebookId,
    selectedNotebookName,
    defaultNotebookId,
    isLoadingNotebooks,
    notebookError,
    loadNotebooks,
    selectAllNotes,
    selectNotebook
  }
}

