<script setup lang="ts">
import type { NoteSummary } from '@qiushi-notes/shared'

defineProps<{
  title: string
  notes: NoteSummary[]
  selectedNoteId: string | null
  isLoading: boolean
}>()

const emit = defineEmits<{
  create: []
  select: [id: string]
}>()
</script>

<template>
  <section class="note-list-pane" aria-label="笔记列表">
    <header class="pane-header split">
      <span>{{ title }}</span>
      <button class="icon-button" type="button" aria-label="新建笔记" @click="emit('create')">+</button>
    </header>

    <div v-if="isLoading" class="note-empty">正在加载</div>
    <div v-else-if="notes.length === 0" class="note-empty">暂无笔记</div>
    <div v-else class="note-list">
      <button
        v-for="note in notes"
        :key="note.id"
        class="note-card"
        :class="{ active: selectedNoteId === note.id }"
        type="button"
        @click="emit('select', note.id)"
      >
        <span class="note-title">{{ note.title }}</span>
        <span class="note-preview">{{ note.contentPreview || ' ' }}</span>
      </button>
    </div>
  </section>
</template>
