<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { fetchTrends } from '../../shared/api.js'
import { UP_COLOR, DOWN_COLOR } from '../../shared/market.js'

const props = defineProps({
  kind: { type: String, required: true }, // stock | fund
  item: { type: Object, required: true },
  quotes: { type: Object, required: true }
})

const stockTrend = ref(null)
const loading = ref(false)
const err = ref(false)

onMounted(async () => {
  if (props.kind !== 'stock') return
  loading.value = true
  try {
    stockTrend.value = await fetchTrends(`${props.item.market}.${props.item.code}`)
  } catch {
    err.value = true
  }
  loading.value = false
})

// 基金：用 background 轮询采样的估算涨跌幅
const fundPoints = computed(() => props.quotes?.sparkline?.[props.item.code] || [])

const color = computed(() => {
  if (props.kind === 'stock') {
    const t = stockTrend.value
    if (!t?.points?.length) return DOWN_COLOR
    return t.points[t.points.length - 1].price >= t.preClose ? UP_COLOR : DOWN_COLOR
  }
  const p = fundPoints.value
  if (!p.length) return DOWN_COLOR
  return p[p.length - 1] >= 0 ? UP_COLOR : DOWN_COLOR
})

const view = computed(() => {
  if (props.kind === 'stock') {
    const t = stockTrend.value
    if (!t?.points?.length) return null
    return { values: t.points.map((p) => p.price), base: t.preClose, tip: `分时 · 昨收 ${t.preClose}` }
  }
  const p = fundPoints.value
  if (p.length < 2) return null
  return { values: p, base: 0, tip: `当日估算涨跌幅采样 ×${p.length}` }
})

const pts = computed(() => {
  const v = view.value
  if (!v) return ''
  const vals = v.values
  const min = Math.min(...vals, v.base)
  const max = Math.max(...vals, v.base)
  const span = max - min || 1
  return vals
    .map((x, i) => `${((i / (vals.length - 1)) * 100).toFixed(2)},${(26 - ((x - min) / span) * 24 + 1).toFixed(2)}`)
    .join(' ')
})
const baseY = computed(() => {
  const v = view.value
  if (!v) return null
  const vals = v.values
  const min = Math.min(...vals, v.base)
  const max = Math.max(...vals, v.base)
  const span = max - min || 1
  return (26 - ((v.base - min) / span) * 24 + 1).toFixed(2)
})
</script>

<template>
  <div class="spark">
    <div v-if="kind === 'stock' && loading" class="tip">加载分时…</div>
    <div v-else-if="!pts" class="tip">{{ err ? '分时数据加载失败' : '暂无走势数据（盘中自动累积）' }}</div>
    <template v-else>
      <svg viewBox="0 0 100 28" preserveAspectRatio="none" class="chart">
        <line x1="0" :y1="baseY" x2="100" :y2="baseY" stroke="var(--border)" stroke-dasharray="2 2" stroke-width="0.4" />
        <polyline :points="pts" fill="none" :stroke="color" stroke-width="1" vector-effect="non-scaling-stroke" />
      </svg>
      <span class="tip">{{ view.tip }}</span>
    </template>
  </div>
</template>

<style scoped>
.spark { display: flex; align-items: center; gap: 12px; padding: 4px 10px; }
.chart { width: 100%; height: 56px; flex: 1; }
.tip { color: var(--fg2); font-size: 0.85em; white-space: nowrap; }
</style>
