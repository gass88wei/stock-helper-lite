<script setup>
import { computed } from 'vue'
import { fmtPrice, clsFor, fmtMoney } from '../../shared/market.js'

// 做T联动条：展示本地 zuot-terminal 的持仓（零仓位的也显示，标记“未填仓位”）
const props = defineProps({ zuot: { type: Object, default: () => ({}) } })
const emit = defineEmits(['open'])

const positions = computed(() => Object.values(props.zuot || {}).filter((p) => p && p.code))
const floatOf = (p) =>
  isFinite(p.price) && isFinite(p.currCost) ? (p.price - p.currCost) * p.currQty : null
const total = computed(() =>
  positions.value.reduce((s, p) => s + (p.currQty > 0 ? floatOf(p) || 0 : 0), 0)
)
</script>

<template>
  <div class="zuot-bar">
    <span class="label" title="来自本地做T全能终端的持仓，只读同步">做T</span>
    <span class="total" :class="clsFor(total)">{{ fmtMoney(total) }}</span>
    <button
      v-for="p in positions"
      :key="p.code"
      class="chip"
      :class="{ empty: !(p.currQty > 0) }"
      :title="
        p.currQty > 0
          ? `成本 ${p.currCost} × ${p.currQty}股 | 现价 ${fmtPrice(p.price)}`
          : '已同步到做T终端，但还没填成本/数量——去做T终端的「做T管理」里填'
      "
      @click="emit('open', p)"
    >
      <span class="n">{{ p.name || p.code }}</span>
      <span v-if="p.currQty > 0" class="f" :class="clsFor(floatOf(p))">
        {{ floatOf(p) == null ? '--' : (floatOf(p) > 0 ? '+' : '') + fmtMoney(floatOf(p)) }}
      </span>
      <span v-else class="f">未填仓位</span>
    </button>
  </div>
</template>

<style scoped>
.zuot-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  flex: none;
}
.label { color: var(--fg2); font-size: 0.85em; flex: none; }
.total { font-weight: 700; flex: none; }
.chip {
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  white-space: nowrap;
  flex: none;
}
.chip:hover { border-color: var(--accent); }
.chip.empty { opacity: 0.72; border-style: dashed; }
.n { color: var(--fg2); font-size: 0.85em; }
.f { font-size: 0.9em; }
</style>
