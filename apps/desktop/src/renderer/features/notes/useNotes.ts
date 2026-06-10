import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { NoteDetail, NoteSummary } from '@qiushi-notes/shared'

const AUTO_SAVE_DELAY_MS = 800

export function useNotes() {
  const notes = ref<NoteSummary[]>([])
  const selectedNote = ref<NoteDetail | null>(null)
  const draftTitle = ref('')
  const draftContent = ref('')
  const isLoading = ref(false)
  const isSaving = ref(false)
  const isApplyingNote = ref(false)
  const saveStatus = ref('未选择笔记')
  const errorMessage = ref('')

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let saveRequestId = 0
  let activeNotebookId: string | null = null
  let defaultNotebookId: string | null = null

  onMounted(() => {
    void loadNotes()
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

  async function loadNotes(preferredNoteId?: string): Promise<void> {
    isLoading.value = true
    errorMessage.value = ''

    try {
      notes.value = await window.qiushi.notes.list({ notebookId: activeNotebookId })

      const nextId =
        preferredNoteId ??
        (selectedNote.value && notes.value.some((note) => note.id === selectedNote.value?.id)
          ? selectedNote.value.id
          : notes.value[0]?.id)

      if (nextId) {
        await selectNote(nextId, { skipPendingSave: true })
      } else {
        await applySelectedNote(null)
      }
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
    } finally {
      isLoading.value = false
    }
  }

  async function selectNote(id: string, options: { skipPendingSave?: boolean } = {}): Promise<void> {
    if (!options.skipPendingSave) {
      await flushPendingSave()
    }

    errorMessage.value = ''

    try {
      const note = await window.qiushi.notes.get(id)
      await applySelectedNote(note)
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
    }
  }

  async function createNote(): Promise<void> {
    await flushPendingSave()
    errorMessage.value = ''

    try {
      const created = await window.qiushi.notes.create({
        notebookId: activeNotebookId ?? defaultNotebookId
      })
      upsertNoteSummary(created)
      await applySelectedNote(created)
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
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
      notes.value = notes.value.filter((note) => note.id !== current.id)
      await applySelectedNote(null)

      if (notes.value[0]) {
        await selectNote(notes.value[0].id, { skipPendingSave: true })
      }
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
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
        upsertNoteSummary(updated)
        saveStatus.value = '已保存'
      }
    } catch (error) {
      if (requestId === saveRequestId) {
        saveStatus.value = '保存失败'
        errorMessage.value = getErrorMessage(error)
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

    // 等 Vue 把 v-model 写入组件后，再重新打开 watcher。
    // 否则“切换笔记”本身会被误判成用户编辑，从而触发一次无意义保存。
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

    notes.value = [...notes.value].sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1
      }

      return b.updatedAt.localeCompare(a.updatedAt)
    })
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

  function clearSaveTimer(): void {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : '发生未知错误'
  }

  async function setActiveNotebook(notebookId: string | null): Promise<void> {
    await flushPendingSave()
    activeNotebookId = notebookId
    await loadNotes()
  }

  function setDefaultNotebook(notebookId: string | null): void {
    defaultNotebookId = notebookId
  }

  return {
    notes,
    selectedNote,
    draftTitle,
    draftContent,
    isLoading,
    isSaving,
    saveStatus,
    errorMessage,
    loadNotes,
    setActiveNotebook,
    setDefaultNotebook,
    selectNote,
    createNote,
    deleteCurrentNote
  }
}
