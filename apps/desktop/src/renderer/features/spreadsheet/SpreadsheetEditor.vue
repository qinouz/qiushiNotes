<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  createUniver,
  LocaleType,
  mergeLocales,
  type IWorkbookData
} from '@univerjs/presets'
import { UniverSheetsCorePreset, type FWorkbook } from '@univerjs/preset-sheets-core'
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN'
import '@univerjs/preset-sheets-core/lib/index.css'

const props = defineProps<{
  noteId: string
  title: string
  content: string
}>()

const emit = defineEmits<{
  'update:content': [value: string]
}>()

type DisposableLike = {
  dispose: () => void
}

type UniverLike = {
  dispose?: () => void
}

type CellPrimitive = string | number | boolean

interface InitialWorkbook {
  data: Partial<IWorkbookData>
  legacyValues: CellPrimitive[][]
  legacyColumnWidths: number[]
  legacyRowHeights: number[]
}

type SheetsApi = ReturnType<typeof createUniver>['univerAPI'] & {
  createWorkbook: (data: Partial<IWorkbookData>) => FWorkbook
  getActiveWorkbook: () => FWorkbook | null
}

const containerRef = ref<HTMLElement | null>(null)
const errorMessage = ref('')

let univerInstance: UniverLike | null = null
let univerAPI: SheetsApi | null = null
let workbook: FWorkbook | null = null
let commandDisposable: DisposableLike | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null
let lastSerializedContent = ''
let isDisposing = false

watch(
  () => props.noteId,
  () => {
    void initializeSpreadsheet()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  flushSnapshot()
  disposeSpreadsheet()
})

async function initializeSpreadsheet(): Promise<void> {
  await nextTick()

  if (!containerRef.value) {
    return
  }

  disposeSpreadsheet()
  await waitForContainerLayout()

  if (!containerRef.value) {
    return
  }

  isDisposing = false
  errorMessage.value = ''
  lastSerializedContent = props.content

  try {
    const initialWorkbook = readWorkbookData(props.content)
    const created = createUniver({
      locale: LocaleType.ZH_CN,
      locales: {
        [LocaleType.ZH_CN]: mergeLocales(UniverPresetSheetsCoreZhCN)
      },
      presets: [
        UniverSheetsCorePreset({
          container: containerRef.value,
          header: false,
          toolbar: true,
          formulaBar: true,
          footer: {
            sheetBar: true,
            statisticBar: true,
            menus: true,
            zoomSlider: true
          }
        })
      ]
    })

    univerInstance = created.univer as UniverLike
    univerAPI = created.univerAPI as SheetsApi
    workbook = univerAPI.createWorkbook(initialWorkbook.data)

    if (initialWorkbook.legacyValues.length > 0) {
      applyLegacyValues(workbook, initialWorkbook)
    }

    commandDisposable = univerAPI.onCommandExecuted((command) => {
      if (!isPersistableCommand(command.id)) {
        return
      }

      scheduleSnapshot()
    })

    resizeObserver = new ResizeObserver(() => {
      window.dispatchEvent(new Event('resize'))
    })
    resizeObserver.observe(containerRef.value)
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
    installSmokeHook()

    if (initialWorkbook.legacyValues.length > 0) {
      scheduleSnapshot()
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '表格初始化失败'
  }
}

async function waitForContainerLayout(): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const element = containerRef.value

    if (!element) {
      return
    }

    if (element.clientWidth > 0 && element.clientHeight > 0) {
      return
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}

function scheduleSnapshot(): void {
  clearSaveTimer()

  saveTimer = setTimeout(() => {
    flushSnapshot()
  }, 500)
}

function flushSnapshot(): void {
  clearSaveTimer()

  if (isDisposing || !workbook) {
    return
  }

  try {
    const serialized = JSON.stringify({
      schemaVersion: 1,
      engine: 'univer',
      engineVersion: '0.25.0',
      savedByFacade: true,
      workbook: workbook.save()
    })

    if (serialized !== lastSerializedContent) {
      lastSerializedContent = serialized
      emit('update:content', serialized)
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '表格保存快照失败'
  }
}

function installSmokeHook(): void {
  if (!window.qiushi.app.isSmokeTest()) {
    return
  }

  // 自动化 smoke 需要从 renderer 外部写一个单元格，但不能绕过真实自动保存链路。
  // 这里仅在 QIUSHI_SMOKE=1 时暴露当前 workbook 的最小操作面，写入后仍走 update:content -> notes:update。
  window.__qiushiSpreadsheetSmoke = {
    noteId: props.noteId,
    setCellValue(row, column, value) {
      if (!workbook) {
        throw new Error('表格尚未初始化。')
      }

      workbook.getActiveSheet().getRange(row, column, 1, 1).setValues([[value]])
      flushSnapshot()
      return lastSerializedContent
    },
    flush() {
      flushSnapshot()
      return lastSerializedContent
    },
    getSerializedContent() {
      return lastSerializedContent
    }
  }
}

function disposeSpreadsheet(): void {
  isDisposing = true
  clearSaveTimer()
  resizeObserver?.disconnect()
  resizeObserver = null
  commandDisposable?.dispose()
  commandDisposable = null

  if (univerAPI && workbook) {
    univerAPI.disposeUnit(workbook.getId())
  }

  workbook = null
  univerAPI = null
  univerInstance?.dispose?.()
  univerInstance = null

  if (containerRef.value) {
    containerRef.value.innerHTML = ''
  }

  if (window.__qiushiSpreadsheetSmoke?.noteId === props.noteId) {
    delete window.__qiushiSpreadsheetSmoke
  }
}

function clearSaveTimer(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

function isPersistableCommand(commandId: string): boolean {
  const normalized = commandId.toLocaleLowerCase()

  // Selection, focus and scroll commands are UI state. Saving them would make a
  // simple click look like a content edit and trigger noisy autosaves.
  return ![
    'selection',
    'scroll',
    'focus',
    'hover',
    'pointer',
    'resize-container',
    'set-active'
  ].some((token) => normalized.includes(token))
}

function readWorkbookData(content: string): InitialWorkbook {
  try {
    const parsed = JSON.parse(content) as unknown
    const wrappedWorkbook = unwrapQiushiWorkbook(parsed)

    if (wrappedWorkbook) {
      if (isSavedByFacade(parsed)) {
        return {
          data: wrappedWorkbook,
          legacyValues: [],
          legacyColumnWidths: [],
          legacyRowHeights: []
        }
      }

      return {
        data: {},
        legacyValues: extractLegacyValues(wrappedWorkbook),
        legacyColumnWidths: extractLegacyColumnWidths(wrappedWorkbook),
        legacyRowHeights: extractLegacyRowHeights(wrappedWorkbook)
      }
    }

    const workbookData = unwrapRawWorkbookData(parsed)

    if (workbookData) {
      return {
        data: workbookData,
        legacyValues: [],
        legacyColumnWidths: [],
        legacyRowHeights: []
      }
    }
  } catch {
    // Invalid JSON should not block the user from opening the note. The original
    // content is still in SQLite until the next successful save writes a fresh snapshot.
  }

  return {
    data: {},
    legacyValues: [createDailyReportHeader()],
    legacyColumnWidths: createDailyReportColumnWidths(),
    legacyRowHeights: [32]
  }
}

function unwrapQiushiWorkbook(value: unknown): Partial<IWorkbookData> | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as { engine?: unknown; workbook?: unknown }

  if (record.engine !== 'univer' || !record.workbook || typeof record.workbook !== 'object') {
    return null
  }

  return record.workbook as Partial<IWorkbookData>
}

function unwrapRawWorkbookData(value: unknown): Partial<IWorkbookData> | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const workbookRecord = value as { id?: unknown; sheets?: unknown }

  return typeof workbookRecord.id === 'string' || workbookRecord.sheets
    ? (value as Partial<IWorkbookData>)
    : null
}

function isSavedByFacade(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { savedByFacade?: unknown }).savedByFacade === true
  )
}

function applyLegacyValues(targetWorkbook: FWorkbook, initialWorkbook: InitialWorkbook): void {
  const sheet = targetWorkbook.getActiveSheet()
  const values = normalizeMatrix(initialWorkbook.legacyValues)

  if (values.length > 0 && values[0].length > 0) {
    sheet.getRange(0, 0, values.length, values[0].length).setValues(values)
  }

  const columnWidths = initialWorkbook.legacyColumnWidths.length > 0
    ? initialWorkbook.legacyColumnWidths
    : createDailyReportColumnWidths()

  columnWidths.forEach((width, index) => {
    sheet.setColumnWidth(index, width)
  })

  const rowHeights = initialWorkbook.legacyRowHeights.length > 0
    ? initialWorkbook.legacyRowHeights
    : [32]

  rowHeights.forEach((height, index) => {
    sheet.setRowHeight(index, height)
  })
}

function normalizeMatrix(values: CellPrimitive[][]): CellPrimitive[][] {
  const matrix = values.length > 0 ? values : [createDailyReportHeader()]
  const width = Math.max(...matrix.map((row) => row.length), 1)

  return matrix.map((row) => {
    const nextRow = [...row]

    while (nextRow.length < width) {
      nextRow.push('')
    }

    return nextRow
  })
}

function extractLegacyValues(workbookData: Partial<IWorkbookData>): CellPrimitive[][] {
  const sheet = getFirstWorksheet(workbookData)
  const cellData = sheet?.cellData

  if (!cellData || typeof cellData !== 'object') {
    return [createDailyReportHeader()]
  }

  const rows: CellPrimitive[][] = []

  for (const [rowKey, rowValue] of Object.entries(cellData as Record<string, unknown>)) {
    const rowIndex = Number(rowKey)

    if (!Number.isInteger(rowIndex) || !rowValue || typeof rowValue !== 'object') {
      continue
    }

    const row: CellPrimitive[] = rows[rowIndex] ?? []

    for (const [columnKey, cellValue] of Object.entries(rowValue as Record<string, unknown>)) {
      const columnIndex = Number(columnKey)
      const value = getCellPrimitive(cellValue)

      if (Number.isInteger(columnIndex) && value !== null) {
        row[columnIndex] = value
      }
    }

    rows[rowIndex] = row
  }

  return rows.length > 0 ? rows : [createDailyReportHeader()]
}

function extractLegacyColumnWidths(workbookData: Partial<IWorkbookData>): number[] {
  const sheet = getFirstWorksheet(workbookData)
  const columnData = sheet?.columnData

  if (!columnData || typeof columnData !== 'object') {
    return createDailyReportColumnWidths()
  }

  return Object.entries(columnData as Record<string, { w?: unknown }>).reduce<number[]>(
    (widths, [key, value]) => {
      const index = Number(key)

      if (Number.isInteger(index) && typeof value?.w === 'number') {
        widths[index] = value.w
      }

      return widths
    },
    []
  )
}

function extractLegacyRowHeights(workbookData: Partial<IWorkbookData>): number[] {
  const sheet = getFirstWorksheet(workbookData)
  const rowData = sheet?.rowData

  if (!rowData || typeof rowData !== 'object') {
    return [32]
  }

  return Object.entries(rowData as Record<string, { h?: unknown }>).reduce<number[]>(
    (heights, [key, value]) => {
      const index = Number(key)

      if (Number.isInteger(index) && typeof value?.h === 'number') {
        heights[index] = value.h
      }

      return heights
    },
    []
  )
}

function getFirstWorksheet(workbookData: Partial<IWorkbookData>): { cellData?: unknown; columnData?: unknown; rowData?: unknown } | null {
  const sheets = workbookData.sheets

  if (!sheets || typeof sheets !== 'object') {
    return null
  }

  const firstSheetId = Array.isArray(workbookData.sheetOrder)
    ? workbookData.sheetOrder[0]
    : Object.keys(sheets)[0]

  return firstSheetId ? (sheets[firstSheetId] as { cellData?: unknown; columnData?: unknown; rowData?: unknown }) ?? null : null
}

function getCellPrimitive(value: unknown): CellPrimitive | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const cell = value as { v?: unknown }

  return typeof cell.v === 'string' || typeof cell.v === 'number' || typeof cell.v === 'boolean'
    ? cell.v
    : null
}

function createDailyReportHeader(): CellPrimitive[] {
  return ['日期', '任务项', '优先级', '状态', '备注']
}

function createDailyReportColumnWidths(): number[] {
  return [90, 280, 100, 100, 220]
}
</script>

<template>
  <div class="spreadsheet-editor">
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    <div ref="containerRef" class="spreadsheet-container" />
  </div>
</template>
