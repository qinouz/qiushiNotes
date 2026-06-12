<script setup lang="ts">
import { onBeforeUnmount, onMounted, type Component } from 'vue'

export interface ContextMenuItem {
  id: string
  icon: Component
  label: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
}

const props = defineProps<{
  items: ContextMenuItem[]
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
  select: [id: string]
}>()

function selectItem(item: ContextMenuItem): void {
  if (item.disabled) {
    return
  }

  emit('select', item.id)
  emit('close')
}

function handlePointerDown(event: MouseEvent): void {
  const target = event.target as HTMLElement | null

  if (!target?.closest('.context-menu')) {
    emit('close')
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close')
  }
}

function handleContextMenu(event: MouseEvent): void {
  if (!(event.target as HTMLElement | null)?.closest('.context-menu')) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handlePointerDown)
  document.addEventListener('contextmenu', handleContextMenu)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', emitClose)
  window.addEventListener('scroll', emitClose, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handlePointerDown)
  document.removeEventListener('contextmenu', handleContextMenu)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', emitClose)
  window.removeEventListener('scroll', emitClose, true)
})

function emitClose(): void {
  emit('close')
}
</script>

<template>
  <div
    class="context-menu"
    role="menu"
    :style="{ left: `${props.x}px`, top: `${props.y}px` }"
    @contextmenu.prevent
  >
    <button
      v-for="item in items"
      :key="item.id"
      class="context-menu-item"
      :class="{ disabled: item.disabled, danger: item.danger }"
      type="button"
      role="menuitem"
      :disabled="item.disabled"
      @click="selectItem(item)"
    >
      <component :is="item.icon" class="context-menu-item-icon" :size="15" :stroke-width="1.9" />
      <span class="context-menu-item-label">{{ item.label }}</span>
      <span v-if="item.shortcut" class="context-menu-item-shortcut">{{ item.shortcut }}</span>
    </button>
  </div>
</template>
