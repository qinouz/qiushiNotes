import { compareDisplayText, type NoteDetail, type NoteSummary, type NoteTreeNode, type NotebookSummary } from '@qiushi-notes/shared'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const AUTO_SAVE_DELAY_MS = 800

export function useNoteTree() {
  const notebooks = ref<NotebookSummary[]>([])
  const notes = ref<NoteSummary[]>([])
  const selectedNote = ref<NoteDetail | null>(null)
  const selectedNodeId = ref<string | null>(null)
  const selectedNotebookId = ref<string | null>(null)
  const expandedNotebookIds = ref<Set<string>>(new Set())
  const searchQuery = ref('')
  const isLoading = ref(false)
  const errorMessage = ref('')
  const defaultNotebookId = ref<string | null>(null)
  const draftTitle = ref('')
  const draftContent = ref('')
  const isSaving = ref(false)
  const isApplyingNote = ref(false)
  const saveStatus = ref('未选择笔记')

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let saveRequestId = 0

  const treeNodes = computed<NoteTreeNode[]>(() =>
    buildTree(notebooks.value, notes.value, expandedNotebookIds.value, searchQuery.value)
  )

  onMounted(() => {
    void loadTree()
  })

  onBeforeUnmount(() => {
    clearSaveTimer()
  })

  watch([draftTitle, draftContent], () => {
    if (isApplyingNote.value || !selectedNote.value) {
      return
    }

    scheduleAutoSave()
  })

  async function loadTree(preferredNodeId?: string): Promise<void> {
    isLoading.value = true
    errorMessage.value = ''

    try {
      const defaultNotebook = await window.qiushi.notebooks.ensureDefault()
      defaultNotebookId.value = defaultNotebook.id
      expandNotebook(defaultNotebook.id)

      const [loadedNotebooks, loadedNotes] = await Promise.all([
        window.qiushi.notebooks.list(),
        window.qiushi.notes.list()
      ])

      notebooks.value = loadedNotebooks
      notes.value = loadedNotes

      await restoreSelection(preferredNodeId)
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '加载失败')
    } finally {
      isLoading.value = false
    }
  }

  async function restoreSelection(preferredNodeId?: string): Promise<void> {
    if (preferredNodeId && notes.value.some((note) => note.id === preferredNodeId)) {
      await selectNoteNode(preferredNodeId, { skipPendingSave: true })
      return
    }

    if (preferredNodeId && notebooks.value.some((notebook) => notebook.id === preferredNodeId)) {
      await selectNotebookNode(preferredNodeId, { skipPendingSave: true })
      return
    }

    if (selectedNote.value && notes.value.some((note) => note.id === selectedNote.value?.id)) {
      await selectNoteNode(selectedNote.value.id, { skipPendingSave: true })
      return
    }

    if (
      selectedNotebookId.value &&
      notebooks.value.some((notebook) => notebook.id === selectedNotebookId.value)
    ) {
      await selectNotebookNode(selectedNotebookId.value, { skipPendingSave: true })
      return
    }

    if (notes.value[0]) {
      await selectNoteNode(notes.value[0].id, { skipPendingSave: true })
      return
    }

    if (defaultNotebookId.value) {
      await selectNotebookNode(defaultNotebookId.value, { skipPendingSave: true })
      return
    }

    await applySelectedNote(null)
  }

  async function selectNode(nodeId: string): Promise<void> {
    if (notes.value.some((note) => note.id === nodeId)) {
      await selectNoteNode(nodeId)
      return
    }

    if (notebooks.value.some((notebook) => notebook.id === nodeId)) {
      await selectNotebookNode(nodeId)
    }
  }

  async function selectNoteNode(
    noteId: string,
    options: { skipPendingSave?: boolean } = {}
  ): Promise<void> {
    if (!options.skipPendingSave) {
      await flushPendingSave()
    }

    errorMessage.value = ''
    selectedNodeId.value = noteId

    try {
      const noteDetail = await window.qiushi.notes.get(noteId)
      selectedNotebookId.value = noteDetail?.notebookId ?? selectedNotebookId.value

      if (noteDetail?.notebookId) {
        expandNotebook(noteDetail.notebookId)
      }

      await applySelectedNote(noteDetail)
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '加载笔记失败')
    }
  }

  async function selectNotebookNode(
    notebookId: string,
    options: { skipPendingSave?: boolean } = {}
  ): Promise<void> {
    if (!options.skipPendingSave) {
      await flushPendingSave()
    }

    selectedNodeId.value = notebookId
    selectedNotebookId.value = notebookId
    expandNotebook(notebookId)
    await applySelectedNote(null)
  }

  function toggleNotebook(notebookId: string): void {
    if (expandedNotebookIds.value.has(notebookId)) {
      expandedNotebookIds.value.delete(notebookId)
    } else {
      expandedNotebookIds.value.add(notebookId)
    }

    expandedNotebookIds.value = new Set(expandedNotebookIds.value)
  }

  async function createNotebook(parentId?: string | null): Promise<void> {
    await flushPendingSave()
    errorMessage.value = ''

    const targetParentId = parentId === undefined ? selectedNotebookId.value : parentId

    try {
      const created = await window.qiushi.notebooks.create({ parentId: targetParentId })

      if (created.parentId) {
        expandNotebook(created.parentId)
      }

      await loadTree(created.id)
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '笔记本创建失败')
    }
  }

  async function renameNotebook(id: string, name: string): Promise<void> {
    errorMessage.value = ''

    try {
      await window.qiushi.notebooks.update(id, { name })
      await loadTree(id)
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '重命名失败')
    }
  }

  async function createNote(_type = 'note'): Promise<void> {
    await flushPendingSave()
    errorMessage.value = ''

    const targetNotebookId = selectedNotebookId.value ?? selectedNote.value?.notebookId ?? defaultNotebookId.value

    try {
      if (targetNotebookId) {
        expandNotebook(targetNotebookId)
      }

      const created = await window.qiushi.notes.create({
        notebookId: targetNotebookId ?? undefined
      })
      await loadTree(created.id)
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '创建笔记失败')
    }
  }

  async function createNoteInNotebook(notebookId: string, _type = 'note'): Promise<void> {
    await flushPendingSave()
    errorMessage.value = ''

    try {
      expandNotebook(notebookId)
      const created = await window.qiushi.notes.create({ notebookId })
      await loadTree(created.id)
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '创建笔记失败')
    }
  }

  async function deleteCurrentNote(): Promise<void> {
    const current = selectedNote.value

    if (!current) {
      return
    }

    clearSaveTimer()
    errorMessage.value = ''

    try {
      await window.qiushi.notes.softDelete(current.id)

      const nextNoteId =
        notes.value.find((note) => note.id !== current.id && note.notebookId === current.notebookId)?.id ??
        notes.value.find((note) => note.id !== current.id)?.id

      await loadTree(nextNoteId)
    } catch (error) {
      errorMessage.value = getErrorMessage(error, '删除失败')
    }
  }

  function scheduleAutoSave(): void {
    clearSaveTimer()
    saveStatus.value = '有未保存更改'

    saveTimer = setTimeout(() => {
      void saveCurrentDraft()
    }, AUTO_SAVE_DELAY_MS)
  }

  async function flushPendingSave(): Promise<void> {
    if (!saveTimer) {
      return
    }

    clearSaveTimer()
    await saveCurrentDraft()
  }

  async function saveCurrentDraft(): Promise<void> {
    const current = selectedNote.value

    if (!current) {
      return
    }

    if (draftTitle.value === current.title && draftContent.value === current.content) {
      saveStatus.value = '已保存'
      return
    }

    const requestId = ++saveRequestId
    isSaving.value = true
    saveStatus.value = '保存中'

    try {
      const updated = await window.qiushi.notes.update(current.id, {
        title: draftTitle.value,
        content: draftContent.value
      })

      if (requestId === saveRequestId) {
        selectedNote.value = updated
        selectedNotebookId.value = updated.notebookId
        upsertNoteSummary(updated)
        saveStatus.value = '已保存'
      }
    } catch (error) {
      if (requestId === saveRequestId) {
        saveStatus.value = '保存失败'
        errorMessage.value = getErrorMessage(error, '保存失败')
      }
    } finally {
      if (requestId === saveRequestId) {
        isSaving.value = false
      }
    }
  }

  async function applySelectedNote(note: NoteDetail | null): Promise<void> {
    isApplyingNote.value = true
    selectedNote.value = note
    draftTitle.value = note?.title ?? ''
    draftContent.value = note?.content ?? ''
    saveStatus.value = note ? '已保存' : '未选择笔记'

    await nextTick()
    isApplyingNote.value = false
  }

  function upsertNoteSummary(note: NoteDetail): void {
    const summary = toSummary(note)
    const index = notes.value.findIndex((item) => item.id === note.id)

    if (index >= 0) {
      notes.value[index] = summary
    } else {
      notes.value.unshift(summary)
    }

    notes.value = [...notes.value]
  }

  function expandNotebook(notebookId: string): void {
    expandedNotebookIds.value.add(notebookId)
    expandedNotebookIds.value = new Set(expandedNotebookIds.value)
  }

  function clearSaveTimer(): void {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  return {
    treeNodes,
    selectedNote,
    selectedNodeId,
    selectedNotebookId,
    searchQuery,
    isLoading,
    errorMessage,
    defaultNotebookId,
    draftTitle,
    draftContent,
    isSaving,
    saveStatus,
    loadTree,
    selectNode,
    toggleNotebook,
    createNotebook,
    renameNotebook,
    createNote,
    createNoteInNotebook,
    deleteCurrentNote
  }
}

function buildTree(
  notebooks: NotebookSummary[],
  notes: NoteSummary[],
  expandedIds: Set<string>,
  query: string
): NoteTreeNode[] {
  const normalizedQuery = normalizeSearchQuery(query)
  const isSearching = normalizedQuery.length > 0
  const notesByNotebook = groupNotesByNotebook(notes)
  const notebooksByParent = groupNotebooksByParent(notebooks)
  const rows: NoteTreeNode[] = []
  const visitedNotebookIds = new Set<string>()

  for (const notebook of notebooksByParent.get(null) ?? []) {
    rows.push(...buildNotebookRows(notebook, 0))
  }

  for (const notebook of notebooks) {
    if (!visitedNotebookIds.has(notebook.id)) {
      rows.push(...buildNotebookRows(notebook, 0))
    }
  }

  for (const note of notesByNotebook.get(null) ?? []) {
    if (!isSearching || noteMatchesQuery(note, normalizedQuery)) {
      rows.push(mapNoteNode(note, 0))
    }
  }

  return rows

  function buildNotebookRows(notebook: NotebookSummary, depth: number): NoteTreeNode[] {
    if (visitedNotebookIds.has(notebook.id)) {
      return []
    }

    visitedNotebookIds.add(notebook.id)

    const isExpanded = isSearching || expandedIds.has(notebook.id)
    const childNotebookRows = (notebooksByParent.get(notebook.id) ?? []).flatMap((child) =>
      buildNotebookRows(child, depth + 1)
    )
    const noteRows = (notesByNotebook.get(notebook.id) ?? [])
      .filter((note) => !isSearching || noteMatchesQuery(note, normalizedQuery))
      .map((note) => mapNoteNode(note, depth + 1))
    const notebookMatches = !isSearching || notebook.name.toLocaleLowerCase().includes(normalizedQuery)
    const shouldRenderNotebook = notebookMatches || childNotebookRows.length > 0 || noteRows.length > 0

    if (!shouldRenderNotebook) {
      return []
    }

    const notebookRow: NoteTreeNode = {
      type: 'notebook',
      id: notebook.id,
      name: notebook.name,
      depth,
      isExpanded,
      notebookId: notebook.id
    }

    if (!isExpanded && !isSearching) {
      return [notebookRow]
    }

    return [notebookRow, ...childNotebookRows, ...noteRows]
  }
}

function groupNotesByNotebook(notes: NoteSummary[]): Map<string | null, NoteSummary[]> {
  const notesByNotebook = new Map<string | null, NoteSummary[]>()

  for (const note of notes) {
    const list = notesByNotebook.get(note.notebookId) ?? []
    list.push(note)
    notesByNotebook.set(note.notebookId, list)
  }

  for (const list of notesByNotebook.values()) {
    list.sort((left, right) => compareDisplayText(left.title, right.title))
  }

  return notesByNotebook
}

function groupNotebooksByParent(notebooks: NotebookSummary[]): Map<string | null, NotebookSummary[]> {
  const notebooksByParent = new Map<string | null, NotebookSummary[]>()

  for (const notebook of notebooks) {
    const siblings = notebooksByParent.get(notebook.parentId) ?? []
    siblings.push(notebook)
    notebooksByParent.set(notebook.parentId, siblings)
  }

  for (const list of notebooksByParent.values()) {
    list.sort(compareNotebooksForTree)
  }

  return notebooksByParent
}

function compareNotebooksForTree(left: NotebookSummary, right: NotebookSummary): number {
  const order = left.sortOrder - right.sortOrder

  if (order !== 0) {
    return order
  }

  return compareDisplayText(left.name, right.name)
}

function mapNoteNode(note: NoteSummary, depth: number): NoteTreeNode {
  return {
    type: 'note',
    id: note.id,
    name: note.title,
    depth,
    isExpanded: false,
    noteId: note.id,
    contentPreview: note.contentPreview,
    updatedAt: note.updatedAt
  }
}

function noteMatchesQuery(note: NoteSummary, normalizedQuery: string): boolean {
  return `${note.title}\n${note.contentPreview}`.toLocaleLowerCase().includes(normalizedQuery)
}

function normalizeSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase()
}

function toSummary(note: NoteDetail): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    contentPreview: note.content.slice(0, 120),
    notebookId: note.notebookId,
    isFavorite: note.isFavorite,
    isPinned: note.isPinned,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt,
    syncStatus: note.syncStatus
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
