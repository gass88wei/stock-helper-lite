// MV3 Service Worker 入口
// 轮询设计（双模式）：
//  - popup 打开时：popup 连接 'ui' 长端口并每 20s 心跳保活 SW → SW 内 pollLoop 按 refreshSec 循环拉行情
//  - popup 关闭后：SW 30s 空闲被杀 → chrome.alarms 每分钟唤醒，交易时段拉一次行情（角标+提醒）
import { loadAll, getQuotes, mergeQuotes, broadcast, portRegistry } from '../shared/store.js'
import { fetchStockQuotes, fetchFundQuotes, fetchZuotState } from '../shared/api.js'
import { isTradingTime } from '../shared/market.js'
import { updateBadge, updateTitle } from './badge.js'
import { checkNotices, fireReplenishment } from './notices.js'

let cfg = null
let pollTimer = null
let polling = false

async function reloadConfig() {
  cfg = await loadAll()
  return cfg
}

const allStockItems = () => cfg.stockGroups.flatMap((g) => g.items)
const allFundItems = () => cfg.fundGroups.flatMap((g) => g.items)

// 一次完整刷新：拉行情 → 写缓存 → 检查提醒 → 更新角标 → 广播页面
async function refreshNow() {
  if (!cfg) await reloadConfig()
  try {
    const stockItems = allStockItems()
    const fundItems = allFundItems()
    const prev = await getQuotes()

    // 做T联动：读本地 zuot-terminal 的持仓（失败静默，不影响行情）
    let zuot = {}
    if (cfg.settings.zuotLink) {
      try {
        zuot = await fetchZuotState(cfg.settings.zuotPort)
      } catch {
        zuot = {}
      }
    }

    const secids = [
      ...new Set([
        ...stockItems.map((it) => `${it.market}.${it.code}`),
        ...cfg.indexItems.map((it) => `${it.market}.${it.code}`)
      ])
    ]
    // 做T持仓也拉行情：优先用上次解析出的市场，否则沪深两个前缀都试
    for (const code of Object.keys(zuot)) {
      const m = prev.zuot?.[code]?.market
      if (m) secids.push(`${m}.${code}`)
      else {
        secids.push(`1.${code}`)
        secids.push(`0.${code}`)
      }
    }
    const codes = [...new Set(fundItems.map((it) => it.code))]
    const [stocks, funds] = await Promise.all([fetchStockQuotes(secids), fetchFundQuotes(codes)])

    // 回填做T持仓的市场/实时价
    const zuotOut = {}
    for (const [code, pos] of Object.entries(zuot)) {
      const m = prev.zuot?.[code]?.market
      const q = stocks[`${m}.${code}`] || stocks[`1.${code}`] || stocks[`0.${code}`]
      zuotOut[code] = q
        ? { ...pos, market: q.market, price: q.price, zdf: q.zdf, name: pos.name || q.name }
        : { ...pos, market: m || null, price: null, zdf: null }
    }

    let quotes = await mergeQuotes({ stocks, funds, zuot: zuotOut, updatedAt: Date.now() })

    // 基金估算涨跌幅采样（迷你图用，保留最近 60 点）
    const sparkline = {}
    for (const it of fundItems) {
      const q = funds[it.code]
      if (q && q.gszzl != null) {
        const arr = quotes.sparkline[it.code] ? [...quotes.sparkline[it.code]] : []
        arr.push(q.gszzl)
        sparkline[it.code] = arr.slice(-60)
      }
    }
    if (Object.keys(sparkline).length) quotes = await mergeQuotes({ sparkline })

    await checkNotices(quotes, cfg)
    updateBadge(cfg.settings, stockItems, fundItems, quotes)
    updateTitle(cfg, quotes)
    broadcast({ type: 'quotes-updated' })
  } catch (e) {
    console.warn('refreshNow failed:', e)
  }
}

// popup 打开期间的主循环
async function pollLoop() {
  if (polling) return
  polling = true
  try {
    while (portRegistry.size > 0) {
      await reloadConfig() // 每轮都重读配置，避免设置页/弹窗改了数据后后台用旧值
      await refreshNow()
      const sec = Math.min(120, Math.max(5, cfg?.settings?.refreshSec || 15))
      await new Promise((r) => {
        pollTimer = setTimeout(r, sec * 1000)
      })
    }
  } finally {
    polling = false
  }
}

// SW 被唤醒（alarm / popup 打开）后用缓存先恢复角标，避免空白
async function applyBadgeFromCache() {
  if (!cfg) await reloadConfig()
  const quotes = await getQuotes()
  updateBadge(cfg.settings, allStockItems(), allFundItems(), quotes)
  updateTitle(cfg, quotes)
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create('tick', { periodInMinutes: 1 })
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'open-window',
      title: '以独立窗口模式打开',
      contexts: ['action']
    })
  })
  await reloadConfig()
  await refreshNow()
})

chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create('tick', { periodInMinutes: 1 })
  await reloadConfig()
  await applyBadgeFromCache()
})

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ui') return
  portRegistry.add(port)
  port.onDisconnect.addListener(() => portRegistry.delete(port))
  pollLoop()
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'ping') {
    sendResponse({ ok: true })
  } else if (msg?.type === 'refresh') {
    reloadConfig()
      .then(refreshNow)
      .then(() => sendResponse({ ok: true }))
    return true
  } else if (msg?.type === 'store-updated') {
    // 页面（popup/options）改了用户数据：重载配置并重算角标
    reloadConfig()
      .then(refreshNow)
      .catch(() => {})
  }
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'tick') return
  await reloadConfig()
  if (!isTradingTime()) return
  if (cfg.settings.replenishmentNotice) fireReplenishment()
  // popup 没开时由 alarm 驱动刷新（开着时 pollLoop 在跑）
  if (portRegistry.size === 0) await refreshNow()
})

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'open-window') {
    chrome.windows.create({
      url: chrome.runtime.getURL('src/popup/index.html'),
      type: 'popup',
      width: 720,
      height: 600,
      top: 120
    })
  }
})
