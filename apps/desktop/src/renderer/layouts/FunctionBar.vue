<script setup lang="ts">
import type { Component } from 'vue'
import { Clock3, FileText, Grid2X2, Settings, Star, Tags, Trash2 } from '@lucide/vue'

defineProps<{
  activeView: string
}>()

const emit = defineEmits<{
  navigate: [view: string]
}>()

interface FunctionMenuItem {
  id: string
  icon: Component
  label: string
  disabled: boolean
}

const primaryMenuItems: FunctionMenuItem[] = [
  { id: 'recent', icon: Clock3, label: '最新', disabled: true },
  { id: 'notes', icon: FileText, label: '笔记', disabled: false },
  { id: 'favorites', icon: Star, label: '收藏', disabled: true },
  { id: 'tags', icon: Tags, label: '标签', disabled: true },
  { id: 'apps', icon: Grid2X2, label: '应用', disabled: true }
]

const utilityMenuItems: FunctionMenuItem[] = [
  { id: 'trash', icon: Trash2, label: '回收站', disabled: true },
  { id: 'settings', icon: Settings, label: '设置', disabled: true }
]
</script>

<template>
  <aside class="function-bar" aria-label="功能导航">
    <nav class="function-menu">
      <button
        v-for="item in primaryMenuItems"
        :key="item.id"
        class="function-item"
        :class="{ active: activeView === item.id, disabled: item.disabled }"
        type="button"
        :disabled="item.disabled"
        :title="item.label"
        @click="emit('navigate', item.id)"
      >
        <component :is="item.icon" class="function-icon" :size="18" :stroke-width="1.9" />
        <span class="function-label">{{ item.label }}</span>
      </button>
    </nav>

    <nav class="function-menu utility">
      <button
        v-for="item in utilityMenuItems"
        :key="item.id"
        class="function-item"
        :class="{ active: activeView === item.id, disabled: item.disabled }"
        type="button"
        :disabled="item.disabled"
        :title="item.label"
        @click="emit('navigate', item.id)"
      >
        <component :is="item.icon" class="function-icon" :size="18" :stroke-width="1.9" />
        <span class="function-label">{{ item.label }}</span>
      </button>
    </nav>
  </aside>
</template>
