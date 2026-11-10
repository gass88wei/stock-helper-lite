<script setup>
import { computed, ref, watch } from 'vue'
import { useStore, notifyStoreChanged } from '../shared/useStore.js'
import { useQuotes } from './useQuotes.js'
import { computeGains } from '../shared/yield.js'
import { addZuotStock } from '../shared/api.js'
import { guid } from '../shared/market.js'
import IndexBar from './components/IndexBar.vue'
import SummaryBar from './components/SummaryBar.vue'
import GroupTabs from './components/GroupTabs.vue'
import SearchAdd from './components/SearchAdd.vue'
import StockTable from './components/StockTable.vue'
import FundTable from './components/FundTable.vue'
import ZuotBar from './components/ZuotBar.vue'

const state = await useStore()
const { quotes, refresh } = await useQuotes()

const tab = ref('stock')
const toast = ref('')
let toastTimer = null
const showToast = (msg) => {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2600)
}

// 同步到做T终端（T 按钮，带成本/数量）
const zuotAdd = async (item, pos = {}) => {
  if (!state.settings.zuotLink) return
  const currCost = Number(pos.currCost) || 0
  const currQty = Number(pos.currQty) || 0
  try {
    const data = await addZuotStock(state.settings.zuotPort, item.code, item.name, currCost, currQty)
    if (data.message === 'exists') {
      showToast(`${item.name} 已在做T终端持仓中`)
    } else if (data.message === 'filled') {
      showToast(`已为 ${item.name} 补填成本 ${currCost} × ${currQty} 股`)
    } else {
      showToast(`已同步 ${item.name} 到做T终端（${currCost} × ${currQty} 股）`)
    }
    // 本地即时呈现，下一次轮询会以真实状态覆盖
    const secid = `${item.market}.${item.code}`
    const q = quotes.value?.stocks?.[secid]
    quotes.value = {
      ...quotes.value,
      zuot: {
        ...(quotes.value?.zuot || {}),
        [item.code]: {
          code: item.code,
          name: item.name,
          currCost,
          currQty,
          baseCost: currCost,
          baseQty: currQty,
          market: item.market,
          price: q?.price ?? null,
          zdf: q?.zdf ?? null
        }
      }
    }
  } catch (e) {
    showToast('做T同步失败：' + (e?.message || e) + '（终端在运行吗？）')
  }
}

// 主题/字号/透明度应用
watch(
  () => [state.settings.isDark, state.settings.fontSize, state.settings.opacity],
  ([dark, font, opacity]) => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.dataset.font = font || 'normal'
    document.body.style.opacity = opacity / 100
  },
  { immediate: true }
)

const gains = computed(() =>
  computeGains(
    state.stockGroups.flatMap((g) => g.items),
    state.fundGroups.flatMap((g) => g.items),
    quotes.value,
    state.settings
  )
)

const updText = computed(() => {
  const t = quotes.value?.updatedAt
  if (!t) return '未更新'
  return new Date(t).toTimeString().slice(0, 8)
})

const curStockGroup = computed(
  () => state.stockGroups.find((g) => g.id === state.curStockGroupId) || state.stockGroups[0]
)
const curFundGroup = computed(
  () => state.fundGroups.find((g) => g.id === state.curFundGroupId) || state.fundGroups[0]
)

// ---------- 分组 ----------
const addGroup = (kind) => {
  const name = prompt('新建分组名称：')
  if (!name?.trim()) return
  const groups = kind === 'stock' ? state.stockGroups : state.fundGroups
  if (groups.length >= 15) return alert('最多 15 个分组')
  const g = { id: 'g-' + guid().slice(0, 8), name: name.trim(), items: [] }
  groups.push(g)
  if (kind === 'stock') state.curStockGroupId = g.id
  else state.curFundGroupId = g.id
}
const renameGroup = (kind, g) => {
  const name = prompt('重命名分组：', g.name)
  if (name?.trim()) g.name = name.trim()
}
const delGroup = (kind, g) => {
  const groups = kind === 'stock' ? state.stockGroups : state.fundGroups
  if (groups.length <= 1) return alert('至少保留一个分组')
  if (!confirm(`删除分组「${g.name}」及其 ${g.items.length} 个自选？`)) return
  groups.splice(groups.indexOf(g), 1)
  if (kind === 'stock' && state.curStockGroupId === g.id) state.curStockGroupId = groups[0].id
  if (kind === 'fund' && state.curFundGroupId === g.id) state.curFundGroupId = groups[0].id
}

// ---------- 自选项 ----------
const addFromSearch = (item) => {
  const kind = tab.value
  const group = kind === 'stock' ? curStockGroup.value : curFundGroup.value
  if (!group) return
  if (group.items.length >= 50) return showToast('每组最多 50 个自选')
  if (group.items.some((x) => x.code === item.code)) return showToast(`${item.name} 已在该分组中`)
  group.items.push(
    kind === 'stock'
      ? { code: item.code, name: item.name, market: item.market, StockType: item.StockType || '' }
      : { code: item.code, name: item.name }
  )
}
const delItem = (kind, item) => {
  const group = kind === 'stock' ? curStockGroup.value : curFundGroup.value
  const i = group.items.indexOf(item)
  if (i >= 0) group.items.splice(i, 1)
  notifyStoreChanged()
}
const topItem = (kind, item) => {
  const group = kind === 'stock' ? curStockGroup.value : curFundGroup.value
  const i = group.items.indexOf(item)
  if (i > 0) {
    group.items.splice(i, 1)
    group.items.unshift(item)
  }
}
const updateItem = (kind, item, patch) => {
  for (const [k, v] of Object.entries(patch)) {
    if (v === '' || v == null) item[k] = undefined
    else item[k] = isFinite(Number(v)) ? Number(v) : v
  }
  notifyStoreChanged() // background 重算角标
}

// ---------- 提醒 ----------
const saveNotices = (kind, item, rows) => {
  const marketCode = kind === 'stock' ? `${item.market}.${item.code}` : undefined
  const belong = (n) =>
    kind === 'stock'
      ? n.kind === 'stock' && n.marketCode === marketCode
      : n.kind === 'fund' && n.code === item.code
  const next = state.notices.filter((n) => !belong(n))
  for (const r of rows) {
    const value = Number(r.value)
    if (!r.value || !isFinite(value) || value <= 0) continue
    next.push({
      id: r.id || guid(),
      kind,
      ...(kind === 'stock' ? { marketCode } : { code: item.code }),
      name: item.name,
      type: r.type,
      value,
      describe: (r.describe || '').trim(),
      status: !!r.status
    })
  }
  state.notices = next
  notifyStoreChanged()
}

// ---------- 其他 ----------
const removeIndex = (it) => {
  const i = state.indexItems.findIndex((x) => x.code === it.code && x.market === it.market)
  if (i >= 0) state.indexItems.splice(i, 1)
}
const openPage = (item) => {
  if (item.market === '1' || item.market === '0') {
    window.open(
      `https://quote.eastmoney.com/${item.market === '1' ? 'sh' : 'sz'}${item.code}.html`,
      '_blank'
    )
  } else if ('market' in item) {
    window.open(`https://so.eastmoney.com/web/s?keyword=${item.code}`, '_blank')
  } else {
    window.open(`https://fund.eastmoney.com/${item.code}.html`, '_blank')
  }
}
const openOptions = () => chrome.runtime.openOptionsPage()
</script>

<template>
  <IndexBar
    v-if="state.settings.showIndexBar"
    :indices="state.indexItems"
    :quotes="quotes"
    @remove="removeIndex"
  />
  <SummaryBar :gains="gains" />
  <ZuotBar
    v-if="state.settings.zuotLink && Object.keys(quotes.zuot || {}).length"
    :zuot="quotes.zuot"
    @open="openPage"
  />

  <div class="main-bar">
    <button :class="{ active: tab === 'stock' }" @click="tab = 'stock'">股票</button>
    <button :class="{ active: tab === 'fund' }" @click="tab = 'fund'">基金</button>
    <span class="spacer"></span>
    <span class="upd">{{ updText }}</span>
    <button class="icon-btn" title="立即刷新" @click="refresh">⟳</button>
    <button class="icon-btn" title="设置" @click="openOptions">⚙</button>
  </div>

  <GroupTabs
    v-if="tab === 'stock'"
    kind="stock"
    :groups="state.stockGroups"
    v-model="state.curStockGroupId"
    @add="addGroup"
    @rename="renameGroup"
    @del="delGroup"
  />
  <GroupTabs
    v-else
    kind="fund"
    :groups="state.fundGroups"
    v-model="state.curFundGroupId"
    @add="addGroup"
    @rename="renameGroup"
    @del="delGroup"
  />

  <SearchAdd :kind="tab" @add="addFromSearch" />

  <StockTable
    v-if="tab === 'stock'"
    :items="curStockGroup?.items || []"
    :columns="state.settings.stockColumns"
    :quotes="quotes"
    :settings="state.settings"
    :notices="state.notices"
    @del="(it) => delItem('stock', it)"
    @top="(it) => topItem('stock', it)"
    @update="(it, p) => updateItem('stock', it, p)"
    @save-notices="(it, rows) => saveNotices('stock', it, rows)"
    @zuot-add="zuotAdd"
    @open="openPage"
  />
  <FundTable
    v-else
    :items="curFundGroup?.items || []"
    :columns="state.settings.fundColumns"
    :quotes="quotes"
    :settings="state.settings"
    :notices="state.notices"
    @del="(it) => delItem('fund', it)"
    @top="(it) => topItem('fund', it)"
    @update="(it, p) => updateItem('fund', it, p)"
    @save-notices="(it, rows) => saveNotices('fund', it, rows)"
    @open="openPage"
  />

  <transition name="toast">
    <div v-if="toast" class="toast-layer">{{ toast }}</div>
  </transition>
</template>

<style scoped>
.main-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 8px;
  border-bottom: 1px solid var(--border);
  flex: none;
}
.main-bar > button {
  padding: 3px 12px;
  border-radius: 4px;
  color: var(--fg2);
}
.main-bar > button.active {
  color: var(--accent);
  background: var(--hover);
  font-weight: 600;
}
.spacer { flex: 1; }
.upd { color: var(--fg2); font-size: 0.85em; margin-right: 4px; }

.toast-layer {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  max-width: 90%;
  background: rgba(30, 31, 34, 0.92);
  color: #fff;
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 0.9em;
  z-index: 99;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
html[data-theme='dark'] .toast-layer { background: rgba(80, 82, 88, 0.95); }
.toast-enter-active, .toast-leave-active { transition: opacity 0.25s, transform 0.25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>
