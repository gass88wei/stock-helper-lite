<script setup>
import { computed } from 'vue'
import { clsFor, fmtMoney } from '../../shared/market.js'

const props = defineProps({ gains: { type: Object, required: true } })

const cells = computed(() => [
  { label: '当日收益', value: props.gains.todayGains, title: `股票 ${fmtMoney(props.gains.stockToday)} / 基金 ${fmtMoney(props.gains.fundToday)}` },
  { label: '总收益', value: props.gains.totalGains },
  { label: '持仓', value: props.gains.position, plain: true }
])
</script>

<template>
  <div class="summary">
    <div v-for="c in cells" :key="c.label" class="cell">
      <span class="label">{{ c.label }}</span>
      <span class="value" :class="c.plain ? '' : clsFor(c.value)" :title="c.title">
        {{ c.value == null || c.value === 0 ? '--' : fmtMoney(c.value) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.summary {
  display: flex;
  padding: 6px 10px;
  gap: 24px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  flex: none;
}
.cell { display: flex; flex-direction: column; gap: 1px; }
.label { color: var(--fg2); font-size: 0.85em; }
.value { font-weight: 600; }
</style>
