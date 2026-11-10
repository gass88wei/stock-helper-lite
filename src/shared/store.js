// chrome.storage 封装（无 Vue 依赖，background 与页面共用）
import { DEFAULT_SETTINGS, DEFAULT_GROUPS, DEFAULT_INDICES } from './defaults.js'

export const SYNC_KEYS = [
  'stockGroups',
  'fundGroups',
  'curStockGroupId',
  'curFundGroupId',
  'indexItems',
  'settings',
  'notices'
]

const asGroups = (v) =>
  Array.isArray(v) && v.length ? v : DEFAULT_GROUPS()

const asGroupItems = (groups) =>
  asGroups(groups).map((g) => ({ ...g, items: Array.isArray(g.items) ? g.items : [] }))

// 用户数据统一存 chrome.storage.local。
// 原因：Helium 等去 Google 化分支的 storage.sync 后端不可用（写入会静默丢失），
// local 配额 10MB 且在本机 100% 可靠；自选/设置/提醒体量远小于配额。
//
// 关键：写入前必须 JSON 规格化！直接把 Vue 的 reactive 代理数组交给
// chrome.storage.set，结构化克隆会把它变成 {0:…} 形状的对象而非数组，
// 下次读取 Array.isArray 判定失败就会回退默认值（表现为“数据丢失”）。
export const saveSync = (obj) => {
  let plain
  try {
    plain = JSON.parse(JSON.stringify(obj))
  } catch (e) {
    console.warn('序列化失败，跳过本次写入:', e)
    return Promise.resolve()
  }
  return chrome.storage.local.set(plain).catch((e) => console.warn('插件存储写入失败:', e))
}

// 修复被旧版本写坏的数据形状：数组被存成了 {0:…} 对象 → 还原为数组
const asArray = (v) => {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') return Object.values(v).filter((x) => x && typeof x === 'object')
  return []
}

// 读取并补全默认值（SW 被杀重启后所有状态从这里恢复）
export async function loadAll() {
  let d = await chrome.storage.local.get(null)
  // 一次性迁移：local 为空但 sync 里有旧数据时（在正常 Chrome 上用过本插件的用户）
  if (d.stockGroups === undefined && d.fundGroups === undefined && d.settings === undefined) {
    try {
      const s = await chrome.storage.sync.get(null)
      if (s.stockGroups || s.fundGroups || s.settings) {
        await chrome.storage.local.set(s)
        d = { ...s, ...d }
      }
    } catch {
      /* sync 不可用则跳过迁移 */
    }
  }
  const groups = asGroupItems(asArray(d.stockGroups))
  const fGroups = asGroupItems(asArray(d.fundGroups))
  return {
    stockGroups: groups,
    fundGroups: fGroups,
    curStockGroupId: d.curStockGroupId || groups[0].id,
    curFundGroupId: d.curFundGroupId || fGroups[0].id,
    indexItems: asArray(d.indexItems).length ? asArray(d.indexItems) : [...DEFAULT_INDICES],
    settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) },
    notices: asArray(d.notices)
  }
}

// 行情缓存（chrome.storage.local）：合并式写入
export async function getQuotes() {
  const d = await chrome.storage.local.get('quotes')
  return (
    d.quotes || {
      stocks: {},
      funds: {},
      sparkline: {}, // 基金估算涨跌幅的最近采样（迷你图）
      zuot: {}, // 做T联动：{code: {…持仓, market, price, zdf}}
      updatedAt: 0
    }
  )
}

export async function mergeQuotes(patch) {
  const cur = await getQuotes()
  const next = {
    ...cur,
    ...patch,
    stocks: { ...cur.stocks, ...(patch.stocks || {}) },
    funds: { ...cur.funds, ...(patch.funds || {}) },
    sparkline: { ...cur.sparkline, ...(patch.sparkline || {}) },
    zuot: { ...cur.zuot, ...(patch.zuot || {}) }
  }
  await chrome.storage.local.set({ quotes: next })
  return next
}

// 向所有打开的扩展页面（popup/options）广播
export function broadcast(message) {
  chrome.runtime.sendMessage(message).catch(() => {}) // 无接收方时忽略
  for (const p of portRegistry) {
    try {
      p.postMessage(message)
    } catch {
      /* port 已断开 */
    }
  }
}

// background 注册进来的 ui 端口集合
export const portRegistry = new Set()
