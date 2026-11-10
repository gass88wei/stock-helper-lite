// 东方财富接口封装（参数逆向自原插件 3.3.0，2026-11-07 实测可用）
// 注意：fundmobapi 裸请求即可（无需伪造 UA/Referer）；fundgz.1234567.cn 已失效不使用。

const PUSH2 = 'https://push2.eastmoney.com'
const STOCK_FIELDS = 'f12,f13,f14,f2,f3,f4,f8,f18'

const toNum = (v) => {
  const n = Number(v)
  return isFinite(n) ? n : null
}

/**
 * 批量拉取股票/指数行情
 * secids: ['1.600519', '0.399006'] （market 1=沪 0=深）
 * 返回 { '1.600519': {code,name,market,price,zdf,zdfPrice,hsl,prevClose,suspended} }
 */
export async function fetchStockQuotes(secids) {
  if (!secids.length) return {}
  const url = `${PUSH2}/api/qt/ulist.np/get?fltt=2&fields=${STOCK_FIELDS}&secids=${secids.join(',')}`
  const res = await fetch(url).then((r) => r.json())
  const diff = res?.data?.diff || []
  const out = {}
  for (const d of diff) {
    const code = String(d.f12)
    const market = String(d.f13)
    const prevClose = toNum(d.f18) ?? 0
    // 停牌：价格/涨跌/涨跌额全 0 或缺失时用昨收顶替（原版逻辑）
    const raw = toNum(d.f2)
    const suspended = raw === null || raw === 0
    out[`${market}.${code}`] = {
      code,
      name: d.f14,
      market,
      price: suspended ? prevClose : raw,
      zdf: suspended ? 0 : (toNum(d.f3) ?? 0),
      zdfPrice: suspended ? 0 : (toNum(d.f4) ?? 0),
      hsl: toNum(d.f8),
      prevClose,
      suspended
    }
  }
  return out
}

/**
 * 批量拉取基金净值/估值
 * 返回 { '110022': {code,name,dwjz,gsz,gszzl,gztime,jzrq,isUpdate} }
 */
export async function fetchFundQuotes(codes) {
  if (!codes.length) return {}
  const deviceid = crypto.randomUUID ? crypto.randomUUID().toUpperCase() : 'Wap'
  const url =
    `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=200` +
    `&plat=Android&appType=ttjj&product=EFund&Version=1&deviceid=${deviceid}&Fcodes=${codes.join(',')}`
  const res = await fetch(url).then((r) => r.json())
  const out = {}
  for (const d of res?.Datas || []) {
    const nav = toNum(d.NAV)
    const gszzlRaw = toNum(d.GSZZL)
    const item = {
      code: d.FCODE,
      name: d.SHORTNAME,
      jzrq: d.PDATE,
      dwjz: nav,
      gsz: null,
      gszzl: null,
      gztime: d.GZTIME,
      isUpdate: false
    }
    const navchgrt = toNum(d.NAVCHGRT)
    if (gszzlRaw !== null && toNum(d.GSZ) !== null) {
      // 盘中估值（由估算涨跌幅反推估值价，与原版一致）
      item.gsz = +(nav + (nav * gszzlRaw) / 100).toFixed(4)
      item.gszzl = gszzlRaw
    } else if (nav !== null && navchgrt !== null) {
      // 非交易时段 / QDII / 已收盘更新：以最新净值充当现价
      item.gsz = nav
      item.gszzl = navchgrt
      item.isUpdate = d.PDATE && d.PDATE !== '--'
    }
    out[d.FCODE] = item
  }
  return out
}

/**
 * 个股当日分时（迷你图用）
 * 返回 { preClose, points: [{time, price}] }
 */
export async function fetchTrends(secid) {
  const url =
    `${PUSH2}/api/qt/stock/trends2/get?secid=${secid}` +
    `&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f53` +
    `&iscr=0&iscca=0&ndays=1&ut=f057cbcbce2a86e2866ab8877db1d059&forcect=1`
  const res = await fetch(url).then((r) => r.json())
  const data = res?.data
  if (!data?.trends?.length) return null
  return {
    preClose: toNum(data.prePrice) ?? 0,
    points: data.trends.map((t) => {
      const [time, price] = t.split(',')
      return { time, price: Number(price) }
    })
  }
}

/**
 * 读取本地「做T全能终端」的持仓状态（zuot-terminal 内置只读 API）
 * 返回 { '600519': {code,name,currCost,currQty,baseCost,baseQty} }
 */
export async function fetchZuotState(port = 27518) {
  const res = await fetch(`http://127.0.0.1:${port}/api/state`)
  if (!res.ok) throw new Error('zuot HTTP ' + res.status)
  const data = await res.json()
  const out = {}
  for (const s of data?.stocks || []) {
    if (!s?.code) continue
    out[String(s.code)] = {
      code: String(s.code),
      name: s.name || '',
      currCost: Number(s.currCost) || 0,
      currQty: Number(s.currQty) || 0,
      baseCost: Number(s.baseCost) || 0,
      baseQty: Number(s.baseQty) || 0
    }
  }
  return out
}

/**
 * 把一只 A 股加入/更新到「做T全能终端」的持仓（带成本和数量）
 * 返回 { ok, message }，message: 'added' | 'exists' | 'filled'
 */
export async function addZuotStock(port = 27518, code, name = '', currCost = 0, currQty = 0) {
  const res = await fetch(`http://127.0.0.1:${port}/api/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, name, currCost: Number(currCost) || 0, currQty: Number(currQty) || 0 })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'HTTP ' + res.status)
  return data
}

/**
 * 搜索股票/指数（searchapi）
 * 返回 [{name, code, market, StockType}]（StockType 如 "沪A"/"指数"/"港股"/"美股"）
 */
export async function searchStocks(q) {
  if (!q) return []
  const and14 = encodeURIComponent(`MultiMatch/Name,Code,PinYin/${q}/true`)
  const fields = encodeURIComponent('Name,Code,PinYin,MarketType,JYS,MktNum,Classify,SecurityTypeName')
  const url =
    `https://searchapi.eastmoney.com/api/Info/Search?appid=el1902262&type=14` +
    `&token=CCSDCZSDCXYMYZYYSYYXSMDDSMDHHDJT&and14=${and14}&returnfields14=${fields}` +
    `&pageIndex14=1&pageSize14=10&isAssociation14=false&_=${Date.now()}`
  const res = await fetch(url).then((r) => r.json())
  if (res?.Message !== '成功') return []
  return (res.Data || [])
    .filter((it) => it.Classify !== 'OTCFUND') // 场外基金走基金搜索
    .map((it) => ({
      name: it.Name,
      code: it.Code,
      market: String(it.MktNum),
      StockType: it.SecurityTypeName || ''
    }))
}

/**
 * 搜索基金（fundsuggest）
 * 返回 [{name, code, StockType}]
 */
export async function searchFunds(q) {
  if (!q) return []
  const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=9&key=${encodeURIComponent(q)}&_=${Date.now()}`
  const res = await fetch(url).then((r) => r.json())
  return (res?.Datas || [])
    .filter((it) => it.FCODE || it.CODE)
    .map((it) => ({
      name: it.SHORTNAME || it.NAME || '',
      code: it.FCODE || it.CODE,
      StockType: it.FundBaseInfo?.FTYPE || ''
    }))
}
