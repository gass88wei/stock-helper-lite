<script setup>
import { computed, ref } from 'vue'
import { FUND_COLUMNS } from '../../shared/defaults.js'
import { fmtPrice, fmtPct, fmtMoney, clsFor } from '../../shared/market.js'
import { fundDtsy, fundZsy, fundSyl, fundCyje } from '../../shared/yield.js'
import Sparkline from './Sparkline.vue'
import NoticePopover from './NoticePopover.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  columns: { type: Object, required: true },
  quotes: { type: Object, required: true },
  settings: { type: Object, required: true },
  notices: { type: Array, default: () => [] }
})
const emit = defineEmits(['del', 'top', 'update', 'saveNotices', 'open'])

const expanded = ref('')
const noticeOpen = ref('')

const qOf = (it) => props.quotes?.funds?.[it.code]
const cols = computed(() => Object.entries(props.columns).filter(([, s]) => s).map(([k]) => k))
const totalCols = computed(() => cols.value.length + 2)

const cellText = (k, it) => {
  const q = qOf(it)
  switch (k) {
    case 'gsz':
      return { text: fmtPrice(q?.gsz, 4), cls: clsFor(q?.gszzl) }
    case 'gszzl':
      return { text: fmtPct(q?.gszzl), cls: clsFor(q?.gszzl) }
    case 'dwjz':
      return { text: fmtPrice(q?.dwjz, 4), cls: '' }
    case 'cyje':
      return { text: it.num ? fmtMoney(fundCyje(it, q)) : '--', cls: '' }
    case 'dtsy': {
      const v = fundDtsy(it, q)
      return { text: it.num ? fmtMoney(v) : '--', cls: clsFor(v) }
    }
    case 'syl': {
      const v = fundSyl(it, q)
      return { text: v == null ? '--' : fmtPct(v), cls: clsFor(v) }
    }
    case 'zsy': {
      const v = fundZsy(it, q)
      return { text: it.num ? fmtMoney(v) : '--', cls: clsFor(v) }
    }
  }
  return { text: '--', cls: '' }
}

const hasNotice = (it) =>
  props.notices.some((n) => n.kind === 'fund' && n.code === it.code && n.status)

const toggleSpark = (it) => {
  expanded.value = expanded.value === it.code ? '' : it.code
  noticeOpen.value = ''
}
const toggleNotice = (it) => {
  noticeOpen.value = noticeOpen.value === it.code ? '' : it.code
  expanded.value = ''
}

const toNum = (v) => {
  const n = Number(v)
  return isFinite(n) ? n : undefined
}
</script>

<template>
  <div class="tbl-wrap">
    <table>
      <thead>
        <tr>
          <th class="name">基金 / 代码</th>
          <th v-for="k in cols" :key="k" class="num">{{ FUND_COLUMNS[k][0] }}</th>
          <th class="ops">操作</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="it in items" :key="it.code">
          <tr>
            <td class="name">
              <a @click="emit('open', it)">{{ it.name }}</a>
              <i>{{ it.code }}</i>
              <em v-if="qOf(it)?.isUpdate">已更新净值</em>
            </td>
            <td v-for="k in cols" :key="k" class="num">
              <input
                v-if="k === 'cost'"
                class="cell-input"
                :value="it.cost"
                placeholder="持仓价"
                @change="emit('update', it, { cost: $event.target.value })"
              />
              <input
                v-else-if="k === 'num'"
                class="cell-input"
                :value="it.num"
                placeholder="份额"
                @change="emit('update', it, { num: Math.max(0, toNum($event.target.value) || 0) })"
              />
              <span v-else :class="cellText(k, it).cls">{{ cellText(k, it).text }}</span>
            </td>
            <td class="ops">
              <button title="估值提醒" :class="{ on: hasNotice(it) }" @click="toggleNotice(it)">🔔</button>
              <button title="当日估值走势" @click="toggleSpark(it)">📈</button>
              <button title="置顶" @click="emit('top', it)">↑</button>
              <button title="删除" class="danger" @click="emit('del', it)">✕</button>
            </td>
          </tr>
          <tr v-if="expanded === it.code">
            <td :colspan="totalCols" class="sub">
              <Sparkline kind="fund" :item="it" :quotes="quotes" />
            </td>
          </tr>
          <tr v-if="noticeOpen === it.code">
            <td :colspan="totalCols" class="sub">
              <NoticePopover
                kind="fund"
                :item="it"
                :notices="notices"
                @save="(rows) => { emit('saveNotices', it, rows); noticeOpen = '' }"
                @close="noticeOpen = ''"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <p v-if="!items.length" class="empty">暂无自选基金，在上方搜索添加</p>
  </div>
</template>

<style scoped>
.tbl-wrap { overflow: auto; flex: 1; }
table { width: 100%; border-collapse: collapse; font-size: 1em; }
th,
td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
th {
  position: sticky;
  top: 0;
  background: var(--bg);
  color: var(--fg2);
  font-weight: 500;
  font-size: 0.85em;
  z-index: 2;
}
.num { text-align: right; }
.name { text-align: left; min-width: 110px; }
.name a { cursor: pointer; font-weight: 500; }
.name a:hover { color: var(--accent); }
.name i { font-style: normal; color: var(--fg2); font-size: 0.82em; margin-left: 4px; }
.name em { font-style: normal; color: var(--down); font-size: 0.75em; border: 1px solid currentColor; border-radius: 3px; padding: 0 3px; margin-left: 4px; }
.ops { text-align: right; }
.ops button { color: var(--fg2); padding: 1px 3px; border-radius: 3px; }
.ops button:hover { color: var(--accent); background: var(--hover); }
.ops button.on { color: var(--accent); }
.ops button.danger:hover { color: var(--up); }
td.sub { padding: 2px 4px; }
.empty { text-align: center; color: var(--fg2); padding: 32px 0; }
</style>
