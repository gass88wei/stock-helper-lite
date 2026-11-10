// 角标与悬浮标题
import { fmtMoneyCompact, UP_COLOR, DOWN_COLOR, fmtPct } from '../shared/market.js'
import { computeGains } from '../shared/yield.js'

export function updateBadge(settings, stockItems, fundItems, quotes) {
  try {
    if (settings.badgeModel === '0') {
      chrome.action.setBadgeText({ text: '' })
      return
    }
    const g = computeGains(stockItems, fundItems, quotes, settings)
    const val = settings.badgeModel === '1' ? g.todayGains : g.todayRate
    if (!isFinite(val) || Math.abs(val) < 0.005) {
      chrome.action.setBadgeText({ text: '' })
      return
    }
    chrome.action.setBadgeText({ text: fmtMoneyCompact(val) })
    chrome.action.setBadgeBackgroundColor({ color: val > 0 ? UP_COLOR : DOWN_COLOR })
    chrome.action.setBadgeTextColor?.({ color: '#ffffff' })
  } catch (e) {
    console.warn('updateBadge', e)
  }
}

export function updateTitle(cfg, quotes) {
  const lines = []
  for (const it of cfg.indexItems.slice(0, 4)) {
    const q = quotes?.stocks?.[`${it.market}.${it.code}`]
    if (q) lines.push(`${q.name}  ${q.price}  ${fmtPct(q.zdf)}`)
  }
  chrome.action.setTitle({ title: lines.join('\n') || '盯盘助手 Lite' })
}
