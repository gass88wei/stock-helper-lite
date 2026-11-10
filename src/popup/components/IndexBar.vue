<script setup>
import { fmtPct, clsFor } from '../../shared/market.js'

const props = defineProps({
  indices: { type: Array, default: () => [] },
  quotes: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['remove'])

const qOf = (it) => props.quotes?.stocks?.[`${it.market}.${it.code}`] || {}
const open = (it) =>
  window.open(`https://quote.eastmoney.com/${it.market === '1' ? 'sh' : 'sz'}${it.code}.html`, '_blank')
</script>

<template>
  <div class="index-bar">
    <div v-for="it in indices" :key="`${it.market}.${it.code}`" class="idx" @click="open(it)">
      <span class="n" :title="it.name">{{ it.name }}</span>
      <span class="p" :class="clsFor(qOf(it).zdf)">{{ qOf(it).price ?? '--' }}</span>
      <span class="z" :class="clsFor(qOf(it).zdf)">{{ fmtPct(qOf(it).zdf) }}</span>
      <span class="x" title="移除" @click.stop="emit('remove', it)">✕</span>
    </div>
  </div>
</template>

<style scoped>
.index-bar {
  display: flex;
  gap: 1px;
  background: var(--border);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  flex: none;
}
.idx {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 6px 7px;
  background: var(--bg);
  white-space: nowrap;
  cursor: pointer;
  position: relative;
}
.n { color: var(--fg2); font-size: 0.85em; }
.idx:hover { background: var(--hover); }
.p { font-weight: 600; }
.z { font-size: 0.9em; }
.x {
  display: none;
  position: absolute;
  right: 2px;
  top: 2px;
  color: var(--fg2);
  font-size: 10px;
  padding: 0 2px;
  border-radius: 3px;
}
.idx:hover .x { display: block; }
.x:hover { color: var(--up); background: var(--hover); }
</style>
