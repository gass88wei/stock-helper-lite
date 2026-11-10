// 价格/估值提醒（判断逻辑移植自原插件 stockNotice.js）
import { isTradingTime, cstNow, todayStr } from '../shared/market.js'
import { saveSync, broadcast } from '../shared/store.js'

function defaultDescribe(n) {
  if (n.kind === 'fund') {
    return n.type === '3' ? `估算涨幅超过 ${n.value}%` : `估算跌幅超过 ${n.value}%`
  }
  return {
    1: `股价涨到 ${n.value}`,
    2: `股价跌到 ${n.value}`,
    3: `日涨幅超过 ${n.value}%`,
    4: `日跌幅超过 ${n.value}%`
  }[n.type]
}

/**
 * 检查全部提醒并触发通知。
 * 与原版一致：仅交易时段触发；通知 id 用分钟桶+code 去重（同分钟不重复弹）。
 * 定制：settings.noticeAutoOff=true 时触发后自动停用该条提醒。
 */
export async function checkNotices(quotes, cfg) {
  const { settings, notices } = cfg
  if (!notices?.length || !isTradingTime()) return
  const bucket = Math.floor(Date.now() / 60000)
  const firedIds = []
  for (const n of notices) {
    if (!n.status) continue
    let hit = false
    let title = ''
    if (n.kind === 'stock') {
      const q = quotes.stocks[n.marketCode]
      if (!q || q.suspended) continue
      const price = q.price
      const zdf = q.zdf
      hit =
        (n.type === '1' && price >= n.value) ||
        (n.type === '2' && price <= n.value) ||
        (n.type === '3' && zdf >= n.value) ||
        (n.type === '4' && zdf <= -Math.abs(n.value))
      title = `${n.name} (${Number(price).toFixed(2)}) (${Number(zdf).toFixed(2)}%)`
    } else {
      if (!settings.fundNotice) continue
      const q = quotes.funds[n.code]
      if (!q || q.gszzl == null) continue
      hit = (n.type === '3' && q.gszzl >= n.value) || (n.type === '4' && q.gszzl <= -Math.abs(n.value))
      title = `${n.name} (${Number(q.gsz ?? q.dwjz).toFixed(4)}) (${Number(q.gszzl).toFixed(2)}%)`
    }
    if (hit) {
      chrome.notifications.create(`${bucket}-${n.kind}-${n.id}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/logo-128.png'),
        title,
        message: n.describe || defaultDescribe(n)
      })
      firedIds.push(n.id)
    }
  }
  if (firedIds.length && settings.noticeAutoOff) {
    const next = notices.map((n) =>
      firedIds.includes(n.id) ? { ...n, status: false, firedAt: Date.now() } : n
    )
    cfg.notices = next
    await saveSync({ notices: next })
    broadcast({ type: 'store-updated' }) // 页面端同步“已停用”状态，避免旧状态写回
  }
}

// 交易日 14:40 补仓提醒（每天一条，id 带日期防重复）
export function fireReplenishment() {
  const cst = cstNow()
  if (cst.getHours() === 14 && cst.getMinutes() === 40) {
    chrome.notifications.create(`${todayStr()}-replenishment`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/logo-128.png'),
      title: '时间提醒',
      message: '现在是 14:40，留意尾盘调仓机会'
    })
  }
}
