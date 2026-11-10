<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useStore, notifyStoreChanged } from '../shared/useStore.js'
import { STOCK_COLUMNS, FUND_COLUMNS, DEFAULT_SETTINGS, DEFAULT_INDICES } from '../shared/defaults.js'
import { searchStocks } from '../shared/api.js'

const state = await useStore()

watch(
  () => state.settings.isDark,
  (dark) => (document.documentElement.dataset.theme = dark ? 'dark' : 'light'),
  { immediate: true }
)

const changed = () => notifyStoreChanged()

// ---------- 列配置 ----------
const stockColList = Object.entries(STOCK_COLUMNS)
const fundColList = Object.entries(FUND_COLUMNS)

// ---------- 分红数据管理（手动录入，供分红率列使用） ----------
const divList = ref([])
let divTimer = null

const loadDividends = async () => {
  const d = await chrome.storage.local.get('quotes')
  const dividends = d.quotes?.dividends || {}
  divList.value = Object.entries(dividends).map(([code, v]) => ({
    code,
    perShare: Number(v.perShare) || 0,
    year: String(v.year || ''),
    ...(v.yield != null ? { yield: v.yield } : {})
  }))
}

const saveDividends = async () => {
  const dividends = {}
  for (const d of divList.value) {
    if (!d.code) continue
    dividends[d.code] = {
      perShare: d.perShare,
      year: d.year,
      yield: d.yield
    }
  }
  await chrome.storage.local.set({ quotes: { dividends } })
  changed()
}

const addDivRow = () => {
  divList.value.push({ code: '', perShare: 0, year: new Date().getFullYear().toString() })
}
const delDivRow = (i) => {
  divList.value.splice(i, 1)
  saveDividends()
}
const saveDivRow = async (i) => {
  await saveDividends()
  changed()
}

// ---------- 指数管理 ----------
const idxQuery = ref('')
const idxResults = ref([])
const idxSearching = ref(false)
let idxTimer = null
watch(idxQuery, (v) => {
  clearTimeout(idxTimer)
  if (!v.trim()) return (idxResults.value = [])
  idxSearching.value = true
  idxTimer = setTimeout(async () => {
    try {
      idxResults.value = (await searchStocks(v.trim())).filter((r) => r.StockType === '指数')
    } catch {
      idxResults.value = []
    }
    idxSearching.value = false
  }, 300)
})
const addIndex = (r) => {
  if (state.indexItems.some((x) => x.code === r.code)) return alert('已添加该指数')
  state.indexItems.push({ name: r.name, code: r.code, market: r.market })
  changed()
  idxQuery.value = ''
  idxResults.value = []
}
const delIndex = (i) => {
  state.indexItems.splice(i, 1)
  changed()
}
const resetIndices = () => {
  state.indexItems = DEFAULT_INDICES.map((x) => ({ ...x }))
  changed()
}

// ---------- 数据备份 ----------
const fileInput = ref(null)
const exportData = () => {
  const payload = {
    app: 'stock-helper-lite',
    version: 1,
    exportedAt: new Date().toISOString(),
    stockGroups: state.stockGroups,
    fundGroups: state.fundGroups,
    curStockGroupId: state.curStockGroupId,
    curFundGroupId: state.curFundGroupId,
    indexItems: state.indexItems,
    settings: state.settings,
    notices: state.notices
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `stock-helper-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

// 旧插件（股票基金助手 3.3.0）「数据文件备份」导出格式的键映射
const LEGACY_STOCK_COL = {
  gp_sj: 'price', gp_zdf: 'zdf', gp_zdfje: 'zdfPrice', gp_ccj: 'initPrice', gp_ccs: 'num',
  gp_ccje: 'ccje', gp_hsl: 'hsl', gp_dtsy: 'dtsy', gp_zsyl: 'zsyl', gp_zsy: 'zsy'
}
const LEGACY_FUND_COL = {
  jj_gz: 'gsz', jj_zdf: 'gszzl', jj_ccj: 'cost', jj_ccs: 'num',
  jj_ccje: 'cyje', jj_dtsy: 'dtsy', jj_zsyl: 'syl', jj_zsy: 'zsy'
}
const legacyConfig = (c) => {
  const s = { ...DEFAULT_SETTINGS }
  if (!c) return s
  if (c.badgeModel != null) s.badgeModel = String(c.badgeModel)
  if (c.isDark != null) s.isDark = !!c.isDark
  if (c.fontSize) s.fontSize = c.fontSize === 'mini' ? 'small' : c.fontSize === 'medium' ? 'normal' : 'large'
  if (c.popup_opacity != null) s.opacity = Number(c.popup_opacity) || 100
  if (c.replenishmentNotice != null) s.replenishmentNotice = !!c.replenishmentNotice
  if (c.stockColumnShow)
    s.stockColumns = Object.fromEntries(
      Object.entries(LEGACY_STOCK_COL).map(([o, n]) => [n, c.stockColumnShow[o] ?? DEFAULT_SETTINGS.stockColumns[n]])
    )
  if (c.fundColumnShow)
    s.fundColumns = Object.fromEntries(
      Object.entries(LEGACY_FUND_COL).map(([o, n]) => [n, c.fundColumnShow[o] ?? DEFAULT_SETTINGS.fundColumns[n]])
    )
  return s
}
const normalizeImport = (data) => {
  const out = {}
  const normGroups = (arr, isStock) =>
    (Array.isArray(arr) ? arr : [])
      .slice(0, 15)
      .map((g, i) => ({
        id: g.id || `g-${i}-${Date.now()}`,
        name: g.name || `分组${i + 1}`,
        items: (g.items || g.data || []).slice(0, 50).map((it) =>
          isStock
            ? {
                code: String(it.code),
                name: it.name,
                market: String(it.market ?? it.MktNum ?? '1'),
                StockType: it.StockType || '',
                ...(it.initPrice != null && it.initPrice !== '' ? { initPrice: Number(it.initPrice) } : {}),
                ...(it.num != null && it.num !== '' ? { num: Number(it.num) } : {}),
                ...(it.isTodybuy ? { isTodybuy: it.isTodybuy } : {})
              }
            : {
                code: String(it.code),
                name: it.name,
                ...(it.cost != null && it.cost !== '' ? { cost: Number(it.cost) } : {}),
                ...(it.num != null && it.num !== '' ? { num: Number(it.num) } : {})
              }
        )
      }))
      .filter((g) => g.items.length)
  if (data.stockGroups || data.stockGroup) out.stockGroups = normGroups(data.stockGroups || data.stockGroup, true)
  if (data.fundGroups || data.fundGroup) out.fundGroups = normGroups(data.fundGroups || data.fundGroup, false)
  const idx = data.indexItems || data.indexItemList
  if (Array.isArray(idx) && idx.length) out.indexItems = idx.map((x) => ({ name: x.name, code: String(x.code), market: String(x.market ?? '1') }))
  if (data.settings) out.settings = { ...DEFAULT_SETTINGS, ...data.settings }
  else if (data.config) out.settings = legacyConfig(data.config)
  // 新格式提醒
  if (Array.isArray(data.notices)) out.notices = data.notices
  // 旧格式 stock_notice {code:{up_price:{num,message,status}, down_price:...}}
  const sn = data.stock_notice
  if (sn && typeof sn === 'object') {
    const list = []
    for (const [code, v] of Object.entries(sn)) {
      if (v.up_price?.num) list.push({ id: `n-${code}-1-${Date.now()}`, kind: 'stock', marketCode: v.market ? `${v.market}.${code}` : code, name: v.name || code, type: '1', value: Number(v.up_price.num), describe: v.up_price.message || '', status: !!v.up_price.status })
      if (v.down_price?.num) list.push({ id: `n-${code}-2-${Date.now()}`, kind: 'stock', marketCode: v.market ? `${v.market}.${code}` : code, name: v.name || code, type: '2', value: Number(v.down_price.num), describe: v.down_price.message || '', status: !!v.down_price.status })
    }
    if (list.length) out.notices = list
  }
  return out
}
const importFile = async (ev) => {
  const file = ev.target.files?.[0]
  if (!file) return
  try {
    const data = JSON.parse(await file.text())
    const patch = normalizeImport(data)
    if (!Object.keys(patch).length) return alert('未识别到可导入的数据')
    if (!confirm(`将导入：${Object.keys(patch).join('、')}，并覆盖对应现有数据，继续？`)) return
    Object.assign(state, patch)
    changed()
    alert('导入成功')
  } catch (e) {
    alert('导入失败：' + e.message)
  }
  ev.target.value = ''
}

onMounted(() => {
  loadDividends()
})

const version = computed(() => chrome.runtime.getManifest().version)
</script>

<template>
  <div class="page">
    <h1>盯盘助手 Lite <small>v{{ version }}</small></h1>

    <section>
      <h2>通用</h2>
      <div class="row">
        <label>行情刷新间隔（秒）</label>
        <input type="number" min="5" max="120" v-model.number="state.settings.refreshSec" @change="changed" />
        <span class="tip">popup 打开期间按此间隔轮询；关闭后后台每分钟检查提醒</span>
      </div>
      <div class="row">
        <label>深色主题</label>
        <input type="checkbox" v-model="state.settings.isDark" @change="changed" />
      </div>
      <div class="row">
        <label>字号</label>
        <select v-model="state.settings.fontSize" @change="changed">
          <option value="small">小</option>
          <option value="normal">中</option>
          <option value="large">大</option>
        </select>
      </div>
      <div class="row">
        <label>界面透明度</label>
        <input type="range" min="30" max="100" v-model.number="state.settings.opacity" @change="changed" />
        <span>{{ state.settings.opacity }}%</span>
      </div>
      <div class="row">
        <label>显示顶部大盘指数</label>
        <input type="checkbox" v-model="state.settings.showIndexBar" @change="changed" />
      </div>
      <div class="row">
        <label>美元兑人民币</label>
        <input type="number" step="0.0001" v-model.number="state.settings.usRate" @change="changed" />
        <label class="gap">港元兑人民币</label>
        <input type="number" step="0.0001" v-model.number="state.settings.hkRate" @change="changed" />
        <span class="tip">美股/港股持仓收益折算</span>
      </div>
    </section>

    <section>
      <h2>角标</h2>
      <div class="row" v-for="(t, v) in { 0: '关闭', 1: '当日总收益额（需填持仓）', 2: '当日总收益率（需填持仓）' }" :key="v">
        <label><input type="radio" :value="v" v-model="state.settings.badgeModel" @change="changed" /> {{ t }}</label>
      </div>
      <div class="row"><span class="tip">红涨绿跌，持仓在表格行内编辑</span></div>
    </section>

    <section>
      <h2>提醒</h2>
      <div class="row">
        <label><input type="checkbox" v-model="state.settings.noticeAutoOff" @change="changed" /> 触发后自动停用（防重复轰炸）</label>
      </div>
      <div class="row">
        <label><input type="checkbox" v-model="state.settings.fundNotice" @change="changed" /> 启用基金估值提醒</label>
      </div>
      <div class="row">
        <label><input type="checkbox" v-model="state.settings.replenishmentNotice" @change="changed" /> 交易日 14:40 补仓提醒</label>
      </div>
      <div class="row"><span class="tip">提醒仅 A 股交易时段触发；个股提醒在 popup 行内 🔔 设置</span></div>
    </section>

    <section>
      <h2>做T终端联动</h2>
      <div class="row">
        <label><input type="checkbox" v-model="state.settings.zuotLink" @change="changed" /> 联动本地「做T全能终端」</label>
      </div>
      <div class="row">
        <label>API 端口</label>
        <input type="number" min="1024" max="65535" v-model.number="state.settings.zuotPort" @change="changed" />
        <span class="tip">需 zuot-terminal（联动版）正在运行；只读其持仓成本，自选行点「T」可把个股加入做T终端（仅本机 127.0.0.1 通信）</span>
      </div>
    </section>

    <section>
      <h2>做T终端联动</h2>
      <div class="row">
        <label><input type="checkbox" v-model="state.settings.zuotLink" @change="changed" /> 联动本地「做T全能终端」</label>
      </div>
      <div class="row">
        <label>API 端口</label>
        <input type="number" min="1024" max="65535" v-model.number="state.settings.zuotPort" @change="changed" />
        <span class="tip">需 zuot-terminal（联动版）正在运行；仅本机 127.0.0.1 只读访问，自选行点「T」可把个股加入做T终端</span>
      </div>
    </section>

    <section>
      <h2>分红筛选</h2>
      <div class="row">
        <label>分红收益率阈值（%）</label>
        <input type="number" step="0.1" v-model.number="state.settings.dividendSettings.threshold" @change="changed" />
        <span class="tip">超过该阈值的股票在表格中高亮标记（默认 3.5%）</span>
      </div>
      <div class="row">
        <label>显示分红率列</label>
        <input type="checkbox" v-model="state.settings.stockColumns.dividendYield" @change="changed" />
        <span class="tip">在股票表格中显示“分红率”列</span>
      </div>
      <div class="row"><span class="tip">手动录入每股分红和分红年份，系统自动计算分红收益率（每股分红 ÷ 当前价格 × 100%）</span></div>
      <div class="dividend-list">
        <table>
          <thead>
            <tr>
              <th>代码</th>
              <th>名称</th>
              <th>每股分红（元）</th>
              <th>分红年份</th>
              <th>分红收益率（%）</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, i) in divList" :key="i">
              <td>
                <input v-model="d.code" placeholder="如 600008" class="cell-input" style="width: 80px" />
              </td>
              <td>
                <input v-model="d.name" placeholder="名称" class="cell-input" style="width: 100px" />
              </td>
              <td>
                <input type="number" step="0.01" v-model.number="d.perShare" class="cell-input" style="width: 80px" />
              </td>
              <td>
                <input v-model="d.year" class="cell-input" style="width: 80px" />
              </td>
              <td>
                <span :class="{ up: d.yield != null && d.yield >= state.settings.dividendSettings.threshold }">
                  {{ d.yield == null ? '--' : d.yield + '%' }}
                </span>
              </td>
              <td>
                <button class="danger" @click="delDivRow(i)">删除</button>
              </td>
            </tr>
            <tr>
              <td colspan="5">
                <button class="ghost" @click="addDivRow">＋ 添加一行</button>
                <button class="primary" @click="saveDivRow">保存</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>股票列配置</h2>
      <div class="cols">
        <label v-for="[k, [label]] in stockColList" :key="k">
          <input type="checkbox" v-model="state.settings.stockColumns[k]" @change="changed" /> {{ label }}
        </label>
      </div>
    </section>

    <section>
      <h2>基金列配置</h2>
      <div class="cols">
        <label v-for="[k, [label]] in fundColList" :key="k">
          <input type="checkbox" v-model="state.settings.fundColumns[k]" @change="changed" /> {{ label }}
        </label>
      </div>
    </section>

    <section>
      <h2>顶部指数</h2>
      <div class="idx-list">
        <span v-for="(it, i) in state.indexItems" :key="`${it.market}.${it.code}`" class="tag">
          {{ it.name }} <a @click="delIndex(i)">✕</a>
        </span>
        <button class="ghost" @click="resetIndices">恢复默认</button>
      </div>
      <div class="row">
        <label>添加指数</label>
        <input v-model="idxQuery" placeholder="搜索指数名称 / 代码，如：上证、000300" />
      </div>
      <div v-if="idxResults.length" class="drop">
        <div v-for="r in idxResults" :key="`${r.market}.${r.code}`" class="drop-row" @click="addIndex(r)">
          {{ r.name }} <i>{{ r.code }}</i>
        </div>
      </div>
    </section>

    <section>
      <h2>数据备份</h2>
      <div class="row">
        <button @click="exportData">导出全部数据（JSON）</button>
        <button @click="fileInput?.click()">导入备份</button>
        <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="importFile" />
      </div>
      <div class="row"><span class="tip">支持导入旧插件「数据文件备份」导出的 JSON（自动映射 stockGroup / config / stock_notice 等旧格式字段）</span></div>
    </section>

    <section>
      <h2>关于</h2>
      <p class="about">
        轻量股票基金盯盘扩展（Manifest V3 + Vue3 重写版）。行情数据来自东方财富公开接口，
        仅本地存储，无账号、无埋点、无第三方上报。收益数据仅为参考，不构成投资建议。
      </p>
    </section>
  </div>
</template>

<style scoped>
.page {
  max-width: 660px;
  margin: 0 auto;
  padding: 24px 20px 60px;
  font-size: 14px;
  background: var(--bg);
  min-height: 100vh;
}
body { background: var(--bg); }
h1 { font-size: 20px; }
h1 small { color: var(--fg2); font-weight: 400; font-size: 0.7em; }
h2 { font-size: 15px; margin: 0 0 10px; color: var(--accent); }
section {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 16px;
  background: var(--bg);
}
.row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.row > label:first-child { min-width: 130px; color: var(--fg); }
label.gap { margin-left: 16px; }
.tip { color: var(--fg2); font-size: 0.85em; }
input[type='number'],
input[type='text'],
select {
  padding: 4px 8px;
  font: inherit;
  color: var(--fg);
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  width: 110px;
}
.row input[type='text'] { flex: 1; }
.cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 14px; }
.idx-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.tag {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2px 10px;
  background: var(--panel);
}
.tag a { cursor: pointer; color: var(--fg2); margin-left: 2px; }
.tag a:hover { color: var(--up); }
button {
  padding: 5px 14px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--panel);
  color: var(--fg);
}
button:hover { border-color: var(--accent); color: var(--accent); }
button.ghost { border: none; color: var(--fg2); background: none; }
.drop {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 8px;
}
.drop-row { padding: 7px 12px; cursor: pointer; }
.drop-row:hover { background: var(--hover); }
.drop-row i { color: var(--fg2); font-style: normal; margin-left: 8px; font-size: 0.85em; }
.about { color: var(--fg2); line-height: 1.7; margin: 0; }
.dividend-list table { width: 100%; border-collapse: collapse; margin-top: 8px; }
.dividend-list th,
.dividend-list td {
  padding: 5px 10px;
  border-bottom: 1px solid var(--border);
  text-align: center;
}
.dividend-list th { background: var(--panel); color: var(--fg2); font-size: 0.85em; }
.dividend-list td input { width: 100%; box-sizing: border-box; }
.dividend-list td .up { color: var(--up); font-weight: 600; }
</style>
