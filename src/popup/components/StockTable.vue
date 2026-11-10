<script setup>
import { computed, ref } from 'vue'
import { STOCK_COLUMNS } from '../../shared/defaults.js'
import { fmtPrice, fmtPct, fmtMoney, clsFor } from '../../shared/market.js'
import { stockDtsy, stockZsy, stockZsyl, stockCcje } from '../../shared/yield.js'
import Sparkline from './Sparkline.vue'
import NoticePopover from './NoticePopover.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  columns: { type: Object, required: true },
  quotes: { type: Object, required: true },
  settings: { type: Object, required: true },
  notices: { type: Array, default: () => [] }
})
const emit = defineEmits(['del', 'top', 'update', 'saveNotices', 'open', 'zuotAdd'])

const expanded = ref('')
const noticeOpen = ref('')
const zuotEdit = ref('')
const zuotForm = ref({ cost: '', qty: '' })

const qOf = (it) => props.quotes?.stocks?.[`${it.market}.${it.code}`]
const cols = computed(() => Object.entries(props.columns).filter(([, s]) => s).map(([k]) => k))
const totalCols = computed(() => cols.value.length + 2)

const cellText = (k, it) => {
  const q = qOf(it)
  switch (k) {
    case 'price':
      return { text: fmtPrice(q?.price), cls: clsFor(q?.zdf) }
    case 'zdf':
      return { text: fmtPct(q?.zdf), cls: clsFor(q?.zdf) }
    case 'zdfPrice':
      return { text: fmtPrice(q?.zdfPrice), cls: clsFor(q?.zdfPrice) }
    case 'hsl':
      return { text: q?.hsl != null ? q.hsl + '%' : '--', cls: '' }
    case 'ccje':
      return { text: it.num ? fmtMoney(stockCcje(it, q)) : '--', cls: '' }
    case 'dtsy': {
      const v = stockDtsy(it, q, props.settings)
      return { text: it.num ? fmtMoney(v) : '--', cls: clsFor(v) }
    }
    case 'zsyl': {
      const v = stockZsyl(it, q)
      return { text: v == null ? '--' : fmtPct(v), cls: clsFor(v) }
    }
    case 'zsy': {
      const v = stockZsy(it, q, props.settings)
      return { text: it.num ? fmtMoney(v) : '--', cls: clsFor(v) }
    }
  }
  return { text: '--', cls: '' }
}

const hasNotice = (it) =>
  props.notices.some(
    (n) => n.kind === 'stock' && n.marketCode === `${it.market}.${it.code}` && n.status
  )

// 做T联动：该股在本地 zuot-terminal 中有持仓时打标
const ztOf = (it) => {
  const p = props.quotes?.zuot?.[it.code]
  return p && p.currQty > 0 ? p : null
}
const ztFloat = (it) => {
  const p = ztOf(it)
  if (!p || !isFinite(p.price)) return null
  return (p.price - p.currCost) * p.currQty
}

const toggleSpark = (it) => {
  expanded.value = expanded.value === it.code ? '' : it.code
  noticeOpen.value = ''
}
const toggleNotice = (it) => {
  noticeOpen.value = noticeOpen.value === it.code ? '' : it.code
  expanded.value = ''
}
const openZuotEdit = (it) => {
  const p = ztOf(it)
  if (p && p.currQty > 0) return // 已有完整持仓，无需再同步
  zuotForm.value = { cost: p?.currCost || '', qty: '' }
  zuotEdit.value = it.code
  noticeOpen.value = ''
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
          <th class="name">名称 / 代码</th>
          <th v-for="k in cols" :key="k" class="num">{{ STOCK_COLUMNS[k][0] }}</th>
          <th class="ops">操作</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="it in items" :key="`${it.market}.${it.code}`">
          <tr :class="{ suspended: qOf(it)?.suspended }">
            <td class="name">
              <a @click="emit('open', it)">{{ it.name }}</a>
              <i>{{ it.code }}</i>
              <em v-if="qOf(it)?.suspended">停牌</em>
              <em v-else-if="it.StockType && !['沪A', '深A'].includes(it.StockType)">{{ it.StockType }}</em>
              <em
                v-if="ztOf(it)"
                class="zt"
                :class="clsFor(ztFloat(it))"
                :title="`做T：成本 ${ztOf(it).currCost} × ${ztOf(it).currQty}股（来自做T全能终端）`"
              >
                做T {{ ztFloat(it) == null ? '--' : fmtMoney(ztFloat(it)) }}
              </em>
            </td>
            <td v-for="k in cols" :key="k" class="num">
              <input
                v-if="k === 'initPrice'"
                class="cell-input"
                :value="it.initPrice"
                placeholder="持仓价"
                @change="emit('update', it, { initPrice: $event.target.value })"
              />
              <input
                v-else-if="k === 'num'"
                class="cell-input"
                :value="it.num"
                placeholder="持仓数"
                @change="emit('update', it, { num: Math.max(0, Math.round(toNum($event.target.value) || 0)) })"
              />
              <span v-else :class="cellText(k, it).cls">{{ cellText(k, it).text }}</span>
            </td>
            <td class="ops">
              <button
                v-if="settings.zuotLink && ['0', '1'].includes(it.market)"
                title="同步到做T终端（填成本和数量）"
                :class="{ on: ztOf(it)?.currQty > 0 }"
                @click="openZuotEdit(it)"
              >T</button>
              <button title="价格提醒" :class="{ on: hasNotice(it) }" @click="toggleNotice(it)">🔔</button>
              <button title="分时" @click="toggleSpark(it)">📈</button>
              <button title="置顶" @click="emit('top', it)">↑</button>
              <button title="删除" class="danger" @click="emit('del', it)">✕</button>
            </td>
          </tr>
          <tr v-if="expanded === it.code">
            <td :colspan="totalCols" class="sub">
              <Sparkline kind="stock" :item="it" :quotes="quotes" />
            </td>
          </tr>
          <tr v-if="noticeOpen === it.code">
            <td :colspan="totalCols" class="sub">
              <NoticePopover
                kind="stock"
                :item="it"
                :notices="notices"
                @save="(rows) => { emit('saveNotices', it, rows); noticeOpen = '' }"
                @close="noticeOpen = ''"
              />
            </td>
          </tr>
          <tr v-if="zuotEdit === it.code">
            <td :colspan="totalCols" class="sub">
              <div class="pop" @click.stop>
                <div class="row">
                  <label class="l">同步到做T终端</label>
                  <input class="cell-input" v-model="zuotForm.cost" placeholder="成本价" />
                  <input class="cell-input" v-model="zuotForm.qty" placeholder="持仓数" />
                  <button class="primary" @click="emit('zuotAdd', it, { currCost: zuotForm.cost, currQty: zuotForm.qty }); zuotEdit = ''">同步</button>
                  <button @click="zuotEdit = ''">取消</button>
                </div>
                <div class="hint">填上成本和数量后，做T条会实时显示这只股的浮动盈亏</div>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <p v-if="!items.length" class="empty">暂无自选，在上方搜索添加</p>
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
.name { text-align: left; min-width: 96px; }
.name a { cursor: pointer; font-weight: 500; }
.name a:hover { color: var(--accent); }
.name i { font-style: normal; color: var(--fg2); font-size: 0.82em; margin-left: 4px; }
.name em { font-style: normal; color: var(--fg2); font-size: 0.75em; border: 1px solid var(--border); border-radius: 3px; padding: 0 3px; margin-left: 4px; }
.name em.zt { border-color: currentColor; }
.name em.zt.up { color: var(--up); }
.name em.zt.down { color: var(--down); }
tr.suspended td.name em { color: var(--up); border-color: var(--up); }
.ops { text-align: right; }
.ops button { color: var(--fg2); padding: 1px 3px; border-radius: 3px; }
.ops button:hover { color: var(--accent); background: var(--hover); }
.ops button.on { color: var(--accent); }
.ops button.danger:hover { color: var(--up); }
.sub > * { vertical-align: middle; }
td.sub { padding: 2px 4px; }
.pop {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 8px;
  margin: 2px 4px;
}
.pop .row { display: flex; align-items: center; gap: 6px; }
.pop .l { color: var(--fg); white-space: nowrap; }
.pop button { padding: 3px 10px; border: 1px solid var(--border); border-radius: 4px; color: var(--fg); }
.pop button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.pop .hint { color: var(--fg2); font-size: 0.8em; margin-top: 4px; }
.empty { text-align: center; color: var(--fg2); padding: 32px 0; }
</style>
