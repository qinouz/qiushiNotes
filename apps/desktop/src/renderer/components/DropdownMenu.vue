<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, type Component } from 'vue'
import { MoreHorizontal, Plus } from '@lucide/vue'

export interface MenuItem {
  id: string
  icon: Component
  label: string
  shortcut?: string
  disabled?: boolean
}

defineProps<{
  items: MenuItem[]
  triggerLabel: string
  triggerTitle?: string
  triggerVariant?: 'primary' | 'icon'
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const isOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)

function toggle(): void {
  isOpen.value = !isOpen.value
}

function close(): void {
  isOpen.value = false
}

function selectItem(item: MenuItem): void {
  if (item.disabled) return
  emit('select', item.id)
  close()
}

function handleClickOutside(event: MouseEvent): void {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div ref="menuRef" class="dropdown-wrapper">
    <button
      class="dropdown-trigger"
      :class="triggerVariant ?? 'icon'"
      type="button"
      :aria-label="triggerLabel"
      :title="triggerTitle ?? triggerLabel"
      @click="toggle"
    >
      <Plus v-if="(triggerVariant ?? 'icon') === 'primary'" :size="16" :stroke-width="2.2" />
      <MoreHorizontal v-else :size="16" :stroke-width="2.2" />
      <span v-if="(triggerVariant ?? 'icon') === 'primary'">{{ triggerLabel }}</span>
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown-menu" role="menu">
        <button
          v-for="item in items"
          :key="item.id"
          class="dropdown-item"
          :class="{ disabled: item.disabled }"
          type="button"
          role="menuitem"
          :disabled="item.disabled"
          @click="selectItem(item)"
        >
          <component :is="item.icon" class="dropdown-item-icon" :size="15" :stroke-width="1.9" />
          <span class="dropdown-item-label">{{ item.label }}</span>
          <span v-if="item.shortcut" class="dropdown-item-shortcut">{{ item.shortcut }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>
