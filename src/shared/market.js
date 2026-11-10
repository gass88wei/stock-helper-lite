// 行情通用工具：交易时段、涨跌颜色、角标压缩格式（移植自原插件 util.js）

// 东八区时间
export function cstNow(date = new Date()) {
  return new Date(date.getTime() + (date.getTimezoneOffset() * 60 + 8 * 3600) * 1000)
}

// A股交易时段（与原版一致：周一~五 9:29-11:31 / 13:00-15:01，边界各放宽 1 分钟；无节假日表）
export function isTradingTime(date = new Date()) {
  const cst = cstNow(date)
  const day = cst.getDay()
  if (day === 0 || day === 6) return false
  const m = cst.getHours() * 60 + cst.getMinutes() + cst.getSeconds() / 60
  return (m >= 9 * 60 + 29 && m <= 11 * 60 + 31) || (m >= 13 * 60 && m <= 15 * 60 + 1)
}

export function todayStr(date = new Date()) {
  return cstNow(date).toISOString().slice(0, 10)
}

// A股习惯：红涨绿跌
export const UP_COLOR = '#f56c6c'
export const DOWN_COLOR = '#67c23a'
export const clsFor = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '')

export function fmtPct(v) {
  const n = Number(v)
  if (!isFinite(n)) return '--'
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%'
}

export function fmtPrice(v, digits = 2) {
  const n = Number(v)
  if (!isFinite(n)) return '--'
  return n.toFixed(digits)
}

// 角标压缩格式（移植原版 formartContent）：<10 两位小数、<100 一位、<1000 整数、≥1000 x.xk、≥100万 xM
export function fmtMoneyCompact(v) {
  const a = Math.abs(Number(v)) || 0
  let s
  if (a < 10) s = a.toFixed(2)
  else if (a < 100) s = a.toFixed(1)
  else if (a < 1000) s = String(Math.round(a))
  else if (a < 1e6) s = (a / 1000).toFixed(1) + 'k'
  else s = (a / 1e6).toFixed(1) + 'M'
  return s
}

// 金额显示（元 → 千分位；超万显示 万元）
export function fmtMoney(v) {
  const n = Number(v)
  if (!isFinite(n) || n === 0) return '0.00'
  const abs = Math.abs(n)
  const s = abs >= 10000 ? (abs / 10000).toFixed(2) + '万' : abs.toFixed(2)
  return (n < 0 ? '-' : '') + s
}

export function guid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
