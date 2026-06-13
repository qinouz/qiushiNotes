<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BackupResult } from '@qiushi-notes/shared'
import { Download, RotateCcw, ShieldCheck } from '@lucide/vue'

const isBusy = ref(false)
const statusMessage = ref('')
const errorMessage = ref('')
const lastBackup = ref<BackupResult | null>(null)

const backupSize = computed(() => {
  if (!lastBackup.value) {
    return ''
  }

  return formatBytes(lastBackup.value.sizeBytes)
})

async function createBackup(): Promise<void> {
  isBusy.value = true
  statusMessage.value = ''
  errorMessage.value = ''

  try {
    lastBackup.value = await window.qiushi.backups.create()
    statusMessage.value = '备份已创建，可以把备份文件复制到另一台电脑。'
  } catch (error) {
    errorMessage.value = getErrorMessage(error, '创建备份失败')
  } finally {
    isBusy.value = false
  }
}

async function restoreBackup(): Promise<void> {
  const confirmed = window.confirm(
    '从备份恢复会用备份包替换当前本机数据。\n\n应用会先自动创建当前数据的安全备份，然后重启。确认继续吗？'
  )

  if (!confirmed) {
    return
  }

  isBusy.value = true
  statusMessage.value = ''
  errorMessage.value = ''

  try {
    const result = await window.qiushi.backups.restoreFromFile()

    if (result.cancelled) {
      statusMessage.value = '已取消恢复。'
      return
    }

    statusMessage.value = result.restored ? '恢复完成，应用正在重启。' : '未执行恢复。'
  } catch (error) {
    errorMessage.value = getErrorMessage(error, '恢复备份失败')
  } finally {
    isBusy.value = false
  }
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
</script>

<template>
  <section class="settings-view" aria-label="设置">
    <header class="settings-header">
      <h1>设置</h1>
      <p>先把数据备份和恢复做稳，再继续往云同步推进。</p>
    </header>

    <div class="settings-section">
      <div class="settings-section-heading">
        <ShieldCheck :size="20" :stroke-width="1.9" />
        <div>
          <h2>数据备份</h2>
          <p>备份文件包含本地笔记数据库和附件目录，请妥善保存。</p>
        </div>
      </div>

      <div class="settings-actions-row">
        <button class="settings-action-button primary" type="button" :disabled="isBusy" @click="createBackup">
          <Download :size="16" :stroke-width="2" />
          创建备份
        </button>
        <button class="settings-action-button" type="button" :disabled="isBusy" @click="restoreBackup">
          <RotateCcw :size="16" :stroke-width="2" />
          从备份恢复
        </button>
      </div>

      <div v-if="lastBackup" class="backup-result">
        <span>最新备份</span>
        <strong>{{ lastBackup.fileName }}</strong>
        <small>{{ backupSize }} · {{ lastBackup.filePath }}</small>
      </div>

      <p v-if="statusMessage" class="settings-status">{{ statusMessage }}</p>
      <p v-if="errorMessage" class="settings-status error">{{ errorMessage }}</p>
    </div>
  </section>
</template>
