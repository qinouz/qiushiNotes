<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { NoteContentFormat, NoteDetail } from '@qiushi-notes/shared'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import Link from '@tiptap/extension-link'
import UnderlineExtension from '@tiptap/extension-underline'
import { TextStyleKit } from '@tiptap/extension-text-style'
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2
} from '@lucide/vue'
import SpreadsheetEditor from '../spreadsheet/SpreadsheetEditor.vue'

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
  'upgrade-content-format': [format: NoteContentFormat]
  delete: []
}>()

const isApplyingEditorContent = ref(false)
const currentFontSize = ref('')
const currentLineHeight = ref('')

const fontSizeOptions = [
  { label: '默认', value: '' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '15', value: '15px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' }
]

const lineHeightOptions = [
  { label: '默认', value: '' },
  { label: '紧凑', value: '1.35' },
  { label: '标准', value: '1.55' },
  { label: '舒展', value: '1.75' },
  { label: '宽松', value: '1.95' }
]

type TextStyleControlEditor = {
  getAttributes: (name: string) => Record<string, unknown>
}

// 父组件使用的是 v-model:title / v-model:content。
// computed 的 get/set 把这套约定包成模板可直接使用的 model。
const titleModel = computed({
  get: () => props.title,
  set: (value: string) => emit('update:title', value)
})

const isMarkdown = computed(() => props.selectedNote?.contentFormat === 'markdown')
const isSpreadsheet = computed(() => props.selectedNote?.contentFormat === 'spreadsheet-json')
const isRichText = computed(() => Boolean(props.selectedNote) && !isMarkdown.value && !isSpreadsheet.value)

const AttachmentImage = Image.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      attachmentId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-attachment-id'),
        renderHTML: (attributes: { attachmentId?: string | null }) =>
          attributes.attachmentId ? { 'data-attachment-id': attributes.attachmentId } : {}
      }
    }
  }
})

const richTextEditor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3]
      }
    }),
    UnderlineExtension,
    TextStyleKit.configure({
      backgroundColor: false,
      color: false,
      fontFamily: false,
      fontSize: {},
      lineHeight: {},
      textStyle: {}
    }),
    Link.configure({
      autolink: true,
      linkOnPaste: true,
      openOnClick: false
    }),
    AttachmentImage.configure({
      allowBase64: false,
      HTMLAttributes: {
        class: 'rich-editor-image'
      }
    }),
    TaskList,
    TaskItem.configure({
      nested: true
    })
  ],
  content: emptyTiptapDocument(),
  editorProps: {
    attributes: {
      class: 'rich-editor-content',
      'aria-label': '正文',
      spellcheck: 'false'
    },
    handlePaste(_view, event) {
      if (!isRichText.value) {
        return false
      }

      const imageFiles = getImageFilesFromClipboard(event)

      if (imageFiles.length === 0) {
        return false
      }

      event.preventDefault()
      void insertPastedImages(imageFiles)
      return true
    }
  },
  onCreate({ editor }) {
    syncTextStyleControls(editor)
  },
  onSelectionUpdate({ editor }) {
    syncTextStyleControls(editor)
  },
  onUpdate({ editor }) {
    syncTextStyleControls(editor)

    if (isApplyingEditorContent.value || !isRichText.value) {
      return
    }

    emit('update:content', JSON.stringify(editor.getJSON()))
    emit('upgrade-content-format', 'tiptap-json')
  }
})

const toolbarItems = [
  {
    id: 'bold',
    icon: Bold,
    title: '加粗',
    isActive: () => richTextEditor.value?.isActive('bold') ?? false,
    run: () => richTextEditor.value?.chain().focus().toggleBold().run()
  },
  {
    id: 'italic',
    icon: Italic,
    title: '斜体',
    isActive: () => richTextEditor.value?.isActive('italic') ?? false,
    run: () => richTextEditor.value?.chain().focus().toggleItalic().run()
  },
  {
    id: 'underline',
    icon: Underline,
    title: '下划线',
    isActive: () => richTextEditor.value?.isActive('underline') ?? false,
    run: () => richTextEditor.value?.chain().focus().toggleUnderline().run()
  },
  {
    id: 'strike',
    icon: Strikethrough,
    title: '删除线',
    isActive: () => richTextEditor.value?.isActive('strike') ?? false,
    run: () => richTextEditor.value?.chain().focus().toggleStrike().run()
  },
  {
    id: 'heading1',
    icon: Heading1,
    title: '一级标题',
    isActive: () => richTextEditor.value?.isActive('heading', { level: 1 }) ?? false,
    run: () => richTextEditor.value?.chain().focus().toggleHeading({ level: 1 }).run()
  },
  {
    id: 'heading2',
    icon: Heading2,
    title: '二级标题',
    isActive: () => richTextEditor.value?.isActive('heading', { level: 2 }) ?? false,
    run: () => richTextEditor.value?.chain().focus().toggleHeading({ level: 2 }).run()
  },
  {
    id: 'bulletList',
    icon: List,
    title: '无序列表',
    isActive: () => richTextEditor.value?.isActive('bulletList') ?? false,
    run: () => richTextEditor.value?.chain().focus().toggleBulletList().run()
  },
  {
    id: 'orderedList',
    icon: ListOrdered,
    title: '有序列表',
    isActive: () => richTextEditor.value?.isActive('orderedList') ?? false,
    run: () => richTextEditor.value?.chain().focus().toggleOrderedList().run()
  },
  {
    id: 'taskList',
    icon: ListChecks,
    title: '待办列表',
    isActive: () => richTextEditor.value?.isActive('taskList') ?? false,
    run: () => richTextEditor.value?.chain().focus().toggleTaskList().run()
  },
  {
    id: 'blockquote',
    icon: Quote,
    title: '引用',
    isActive: () => richTextEditor.value?.isActive('blockquote') ?? false,
    run: () => richTextEditor.value?.chain().focus().toggleBlockquote().run()
  },
  {
    id: 'codeBlock',
    icon: Code2,
    title: '代码块',
    isActive: () => richTextEditor.value?.isActive('codeBlock') ?? false,
    run: () => richTextEditor.value?.chain().focus().toggleCodeBlock().run()
  },
  {
    id: 'link',
    icon: Link2,
    title: '链接',
    isActive: () => richTextEditor.value?.isActive('link') ?? false,
    run: () => toggleLink()
  },
  {
    id: 'horizontalRule',
    icon: Minus,
    title: '分割线',
    isActive: () => false,
    run: () => richTextEditor.value?.chain().focus().setHorizontalRule().run()
  },
  {
    id: 'undo',
    icon: Undo2,
    title: '撤销',
    isActive: () => false,
    run: () => richTextEditor.value?.chain().focus().undo().run()
  },
  {
    id: 'redo',
    icon: Redo2,
    title: '重做',
    isActive: () => false,
    run: () => richTextEditor.value?.chain().focus().redo().run()
  }
]

watch(
  () => [props.selectedNote?.id, props.selectedNote?.contentFormat] as const,
  async () => {
    if (!richTextEditor.value || !isRichText.value) {
      return
    }

    isApplyingEditorContent.value = true
    richTextEditor.value.commands.setContent(toTiptapDocument(props.content, props.selectedNote?.contentFormat), {
      emitUpdate: false
    })

    await nextTick()
    syncTextStyleControls(richTextEditor.value)
    isApplyingEditorContent.value = false
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  richTextEditor.value?.destroy()
})

function handleMarkdownInput(event: Event): void {
  emit('update:content', (event.target as HTMLTextAreaElement).value)
}

function handleFontSizeChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  const editor = richTextEditor.value

  if (!editor) {
    return
  }

  const chain = editor.chain().focus()
  value ? chain.setFontSize(value).run() : chain.unsetFontSize().run()
  currentFontSize.value = value
}

function handleLineHeightChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  const editor = richTextEditor.value

  if (!editor) {
    return
  }

  const chain = editor.chain().focus()
  value ? chain.setLineHeight(value).run() : chain.unsetLineHeight().run()
  currentLineHeight.value = value
}

function syncTextStyleControls(editor: TextStyleControlEditor | null | undefined): void {
  if (!editor) {
    currentFontSize.value = ''
    currentLineHeight.value = ''
    return
  }

  const attributes = editor.getAttributes('textStyle') as {
    fontSize?: string | null
    lineHeight?: string | null
  }

  currentFontSize.value = attributes.fontSize ?? ''
  currentLineHeight.value = attributes.lineHeight ?? ''
}

async function insertPastedImages(files: File[]): Promise<void> {
  const noteId = props.selectedNote?.id
  const editor = richTextEditor.value

  if (!noteId || !editor) {
    return
  }

  try {
    for (const file of files) {
      const attachment = await window.qiushi.attachments.saveImageFromPaste({
        noteId,
        fileName: file.name || '粘贴图片',
        mimeType: file.type,
        data: await file.arrayBuffer()
      })

      if (props.selectedNote?.id !== noteId) {
        return
      }

      editor
        .chain()
        .focus()
        .insertContent({
          type: 'image',
          attrs: {
            src: attachment.url,
            alt: attachment.fileName,
            title: attachment.fileName,
            attachmentId: attachment.id
          }
        })
        .run()
    }
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '粘贴图片失败')
  }
}

function getImageFilesFromClipboard(event: ClipboardEvent): File[] {
  const dataTransfer = event.clipboardData

  if (!dataTransfer) {
    return []
  }

  const files = Array.from(dataTransfer.files).filter((file) => file.type.startsWith('image/'))

  if (files.length > 0) {
    return files
  }

  return Array.from(dataTransfer.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))
}

function toggleLink(): void {
  const editor = richTextEditor.value

  if (!editor) {
    return
  }

  const previousUrl = editor.getAttributes('link').href as string | undefined
  const nextUrl = window.prompt('链接地址', previousUrl ?? '')

  if (nextUrl === null) {
    return
  }

  if (nextUrl.trim() === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  editor.chain().focus().extendMarkRange('link').setLink({ href: nextUrl.trim() }).run()
}

function emptyTiptapDocument(): JSONContent {
  return {
    type: 'doc',
    content: [{ type: 'paragraph' }]
  }
}

function toTiptapDocument(content: string, format: NoteContentFormat | undefined): JSONContent {
  if (format === 'tiptap-json') {
    try {
      return JSON.parse(content) as JSONContent
    } catch {
      return plainTextToTiptapDocument(content)
    }
  }

  return plainTextToTiptapDocument(content)
}

function plainTextToTiptapDocument(content: string): JSONContent {
  const lines = content.length > 0 ? content.split(/\r?\n/) : ['']

  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : undefined
    }))
  }
}
</script>

<template>
  <section class="editor-pane" aria-label="编辑器">
    <header class="editor-toolbar split">
      <input
        v-model="titleModel"
        class="title-input"
        aria-label="标题"
        :disabled="!selectedNote"
        placeholder="未命名笔记"
        spellcheck="false"
      />

      <div class="editor-actions">
        <span v-if="isMarkdown" class="note-format-badge">
          Markdown
        </span>
        <span v-else-if="isSpreadsheet" class="note-format-badge">
          表格
        </span>
        <span v-else-if="selectedNote" class="note-format-badge">
          富文本
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

    <div v-if="selectedNote && isRichText" class="rich-editor-toolbar" aria-label="富文本工具栏">
      <label class="toolbar-select-label">
        <span>字号</span>
        <select
          class="toolbar-select font-size-select"
          :value="currentFontSize"
          aria-label="字号"
          @change="handleFontSizeChange"
        >
          <option v-for="option in fontSizeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="toolbar-select-label">
        <span>行距</span>
        <select
          class="toolbar-select line-height-select"
          :value="currentLineHeight"
          aria-label="行距"
          @change="handleLineHeightChange"
        >
          <option v-for="option in lineHeightOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <span class="toolbar-divider" aria-hidden="true"></span>

      <button
        v-for="item in toolbarItems"
        :key="item.id"
        class="icon-button"
        :class="{ active: item.isActive() }"
        type="button"
        :title="item.title"
        :aria-label="item.title"
        @click="item.run()"
      >
        <component :is="item.icon" :size="16" :stroke-width="2" />
      </button>
    </div>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <EditorContent
      v-if="selectedNote && isRichText"
      class="rich-editor-surface"
      :editor="richTextEditor"
    />
    <SpreadsheetEditor
      v-else-if="selectedNote && isSpreadsheet"
      :note-id="selectedNote.id"
      :title="title"
      :content="content"
      @update:content="emit('update:content', $event)"
    />

    <textarea
      v-else-if="selectedNote"
      class="editor-surface"
      aria-label="正文"
      placeholder="开始记录..."
      spellcheck="false"
      :value="content"
      @input="handleMarkdownInput"
    />
    <div v-else class="editor-empty">选择或新建一条笔记</div>
  </section>
</template>
