<script setup lang="ts">
import { computed } from 'vue'
import type { NoteDetail } from '@qiushi-notes/shared'

const props = defineProps<{
  selectedNote: NoteDetail | null
  title: string
  content: string
  isSaving: boolean
  saveStatus: string
  errorMessage: string
}>()

const emit = defineEmits<{
  'update:title': [value: string]
  'update:content': [value: string]
  delete: []
}>()

// 父组件使用的是 v-model:title / v-model:content。
// 在子组件里，Vue 的约定是：读取 props.title，修改时 emit('update:title', value)。
// computed 的 get/set 可以把这套约定包装成普通 v-model，模板会更好读。
const titleModel = computed({
  get: () => props.title,
  set: (value: string) => emit('update:title', value)
})

const contentModel = computed({
  get: () => props.content,
  set: (value: string) => emit('update:content', value)
})
</script>

<template>
  <section class="editor-pane" aria-label="编辑器">
    <header class="editor-toolbar split">
      <input
        class="title-input"
        aria-label="标题"
        v-model="titleModel"
        :disabled="!selectedNote"
        placeholder="未命名笔记"
      />

      <div class="editor-actions">
        <span v-if="selectedNote?.contentFormat === 'markdown'" class="note-format-badge">
          Markdown
        </span>
        <span class="save-status" :class="{ saving: isSaving }">{{ saveStatus }}</span>
        <button
          class="text-button danger"
          type="button"
          :disabled="!selectedNote"
          @click="emit('delete')"
        >
          删除
        </button>
      </div>
    </header>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    <textarea
      v-if="selectedNote"
      class="editor-surface"
      aria-label="正文"
      placeholder="开始记录..."
      v-model="contentModel"
    />
    <div v-else class="editor-empty">选择或新建一条笔记</div>
  </section>
</template>
