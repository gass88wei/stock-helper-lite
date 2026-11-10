// 收益计算（移植自原插件 stockYield.js / fundYield.js 的公式）
import { todayStr } from './market.js'

const rateOf = (item, settings) => {
  const t = item.StockType || ''
  if (t.includes('美')) return Number(settings?.usRate) || 1
  if (t.includes('港')) return Number(settings?.hkRate) || 1
  return 1
}

// 股票当天收益：今日建仓用 (现价-成本)×量，否则 涨跌额×量
export function stockDtsy(item, q, settings) {
  if (!item.num || !isFinite(q?.price)) return 0
  if (item.isTodybuy === todayStr()) {
    return ((q.price - Number(item.initPrice) || 0) * item.num) * rateOf(item, settings)
  }
  return (Number(q?.zdfPrice) || 0) * item.num * rateOf(item, settings)
}

export const stockCcje = (item, q) => (item.num ? (Number(q?.price) || 0) * item.num : 0)
export const stockZsy = (item, q, settings) =>
  item.num && isFinite(Number(item.initPrice))
    ? ((Number(q?.price) || 0) - Number(item.initPrice)) * item.num * rateOf(item, settings)
    : 0
export const stockZsyl = (item, q) =>
  item.num && Number(item.initPrice) > 0
    ? (((Number(q?.price) || 0) - Number(item.initPrice)) / Number(item.initPrice)) * 100
    : null

// 基金当天收益：净值已更新用修正式，否则 (估值-净值)×份额
export function fundDtsy(item, q) {
  if (!item.num || !isFinite(q?.dwjz)) return 0
  if (q.isUpdate) {
    const dwjz = q.dwjz
    return (dwjz - dwjz / (1 + (q.gszzl || 0) / 100)) * item.num
  }
  if (!isFinite(q?.gsz)) return 0
  return (q.gsz - q.dwjz) * item.num
}

export const fundCyje = (item, q) => (item.num ? (Number(q?.gsz) || 0) * item.num : 0)
export const fundZsy = (item, q) =>
  item.num && isFinite(Number(item.cost)) ? ((Number(q?.gsz) || 0) - Number(item.cost)) * item.num : 0
export const fundSyl = (item, q) =>
  item.num && Number(item.cost) > 0
    ? (((Number(q?.gsz) || 0) - Number(item.cost)) / Math.abs(Number(item.cost))) * 100
    : null

/**
 * 汇总收益（角标/汇总条用）
 * stockItems: 当前全部股票自选（含 initPrice/num），fundItems 同理
 * quotes: { stocks: {secid: 行情}, funds: {code: 行情} }
 */
export function computeGains(stockItems, fundItems, quotes, settings) {
  let sToday = 0, sTotal = 0, sPos = 0
  for (const it of stockItems) {
    if (!it.num) continue
    const q = quotes?.stocks?.[`${it.market}.${it.code}`]
    sToday += stockDtsy(it, q, settings)
    sTotal += stockZsy(it, q, settings)
    sPos += stockCcje(it, q)
  }
  let fToday = 0, fTotal = 0, fPos = 0
  for (const it of fundItems) {
    if (!it.num) continue
    const q = quotes?.funds?.[it.code]
    fToday += fundDtsy(it, q)
    fTotal += fundZsy(it, q)
    fPos += fundCyje(it, q)
  }
  const todayGains = sToday + fToday
  const totalGains = sTotal + fTotal
  const position = sPos + fPos
  // 与原版一致：今日收益率 = 今日收益 / (持仓 - 今日收益) × 100
  const base = position - todayGains
  const todayRate = base !== 0 && isFinite(base) ? (todayGains / base) * 100 : null
  const totalRate = fTotal + sTotal
  const costBase = position - totalGains
  return {
    todayGains,
    totalGains,
    position,
    todayRate,
    stockToday: sToday,
    fundToday: fToday
  }
}
