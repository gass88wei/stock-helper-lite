// 测试用 chrome API + 东财接口 mock（仅 test/ 目录，不进生产构建）
(function () {
  const syncData = {
    stockGroups: [
      {
        id: 'g1',
        name: '默认分组',
        items: [
          { code: '600519', name: '贵州茅台', market: '1', StockType: '沪A', initPrice: 1400, num: 100 },
          { code: '000001', name: '平安银行', market: '0', StockType: '深A' },
          { code: 'AAPL', name: '苹果', market: '105', StockType: '美股', initPrice: 170, num: 10 }
        ]
      }
    ],
    fundGroups: [
      {
        id: 'f1',
        name: '默认分组',
        items: [{ code: '110022', name: '易方达消费行业股票', cost: 2.8, num: 1000 }]
      }
    ],
    curStockGroupId: 'g1',
    curFundGroupId: 'f1',
    indexItems: [
      { name: '上证指数', code: '000001', market: '1' },
      { name: '沪深300', code: '000300', market: '1' },
      { name: '深证成指', code: '399001', market: '0' },
      { name: '创业板指', code: '399006', market: '0' }
    ],
    settings: {
      refreshSec: 15,
      badgeModel: '1',
      isDark: false,
      showIndexBar: true,
      fontSize: 'normal',
      opacity: 100,
      usRate: 6.4708,
      hkRate: 0.8346,
      noticeAutoOff: true,
      fundNotice: true,
      replenishmentNotice: false,
      zuotLink: true,
      zuotPort: 27518,
      stockColumns: {
        price: true, initPrice: true, num: true, ccje: true, zdf: true,
        zdfPrice: true, hsl: false, dtsy: true, zsyl: true, zsy: true
      },
      fundColumns: {
        gsz: true, gszzl: true, dwjz: true, cost: true, num: true,
        cyje: true, dtsy: true, syl: true, zsy: true
      }
    },
    notices: [
      {
        id: 'n1', kind: 'stock', marketCode: '1.600519', name: '贵州茅台',
        type: '1', value: 1000, describe: '茅台到 1000 了', status: true
      }
    ]
  }

  const localData = {
    quotes: {
      stocks: {
        '1.600519': { code: '600519', name: '贵州茅台', market: '1', price: 1453.0, zdf: 0.07, zdfPrice: 1.01, hsl: 0.62, prevClose: 1451.99, suspended: false },
        '0.000001': { code: '000001', name: '平安银行', market: '0', price: 12.34, zdf: -1.12, zdfPrice: -0.14, hsl: 0.88, prevClose: 12.48, suspended: false },
        '105.AAPL': { code: 'AAPL', name: '苹果', market: '105', price: 232.5, zdf: 1.24, zdfPrice: 2.85, hsl: null, prevClose: 229.65, suspended: false },
        '1.000001': { code: '000001', name: '上证指数', market: '1', price: 3649.18, zdf: -1.1, zdfPrice: -40.6, hsl: null, prevClose: 3689.78, suspended: false },
        '1.000300': { code: '000300', name: '沪深300', market: '1', price: 4210.55, zdf: -0.92, zdfPrice: -39.1, hsl: null, prevClose: 4249.65, suspended: false },
        '0.399001': { code: '399001', name: '深证成指', market: '0', price: 11890.2, zdf: -1.65, zdfPrice: -199.5, hsl: null, prevClose: 12089.7, suspended: false },
        '0.399006': { code: '399006', name: '创业板指', market: '0', price: 2465.23, zdf: -3.96, zdfPrice: -101.7, hsl: null, prevClose: 2566.9, suspended: false }
      },
      funds: {
        110022: { code: '110022', name: '易方达消费行业股票', jzrq: '2026-11-06', dwjz: 3.005, gsz: 3.0241, gszzl: 0.63, gztime: '2026-11-07 15:00', isUpdate: false }
      },
      sparkline: { 110022: [0.12, 0.35, 0.21, 0.48, 0.63, 0.55, 0.7, 0.63] },
      zuot: {
        // 600519 在插件自选里（行内标签），600225 不在（仅做T条展示）
        600519: { code: '600519', name: '贵州茅台', currCost: 1400, currQty: 100, baseCost: 1350, baseQty: 200, market: '1', price: 1453.0, zdf: 0.07 },
        600225: { code: '600225', name: '等公共', currCost: 1.3012, currQty: 4000, baseCost: 1.35, baseQty: 4000, market: '0', price: 1.28, zdf: -1.5 }
      },
      updatedAt: Date.now()
    }
  }

  const pick = (obj, keys) => {
    if (keys == null) return { ...obj }
    if (typeof keys === 'string') keys = [keys]
    const out = {}
    for (const k of keys) if (k in obj) out[k] = obj[k]
    return out
  }

  const storageArea = (data) => ({
    get: async (keys) => pick(data, keys),
    set: async (o) => Object.assign(data, o),
    remove: async (keys) => { for (const k of [].concat(keys)) delete data[k] },
    clear: async () => { for (const k of Object.keys(data)) delete data[k] }
  })

  const listeners = { msg: [] }
  window.chrome = {
    runtime: {
      connect: () => ({
        onMessage: { addListener() {} },
        postMessage() {},
        disconnect() {}
      }),
      sendMessage: async () => ({}),
      onMessage: { addListener(fn) { listeners.msg.push(fn) } },
      getManifest: () => ({ version: '0.1.0-test' }),
      getURL: (p) => '/' + p,
      openOptionsPage: async () => {}
    },
    storage: { sync: storageArea(syncData), local: storageArea(localData) },
    alarms: { create() {}, onAlarm: { addListener() {} } },
    notifications: { create() {}, onButtonClicked: { addListener() {} } },
    contextMenus: { create() {}, removeAll() {}, onClicked: { addListener() {} } },
    action: {
      setBadgeText() {}, setBadgeBackgroundColor() {}, setBadgeTextColor() {}, setTitle() {}
    },
    __mock: { syncData, localData }
  }

  // ---- fetch mock：拦截东财接口，返回罐头数据 ----
  const realFetch = window.fetch.bind(window)
  window.fetch = async (url, opts) => {
    url = String(url)
    const json = (data) =>
      new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })

    if (url.includes('/api/qt/ulist.np/get')) {
      const secids = new URL(url).searchParams.get('secids') || ''
      const diff = secids.split(',').filter(Boolean).map((s) => {
        const q = localData.quotes.stocks[s]
        return q && {
          f12: q.code, f13: q.market, f14: q.name,
          f2: q.suspended ? 0 : q.price, f3: q.zdf, f4: q.zdfPrice, f8: q.hsl, f18: q.prevClose
        }
      }).filter(Boolean)
      return json({ rc: 0, data: { diff } })
    }
    if (url.includes('trends2/get')) {
      const pts = []
      for (let i = 0; i < 60; i++) {
        pts.push(`09:30,${(1440 + Math.sin(i / 6) * 8 + i * 0.2).toFixed(2)}`)
      }
      return json({ rc: 0, data: { name: '贵州茅台', prePrice: 1451.99, trends: pts } })
    }
    if (url.includes('/api/stock') && opts?.method === 'POST') {
      return json({ ok: true, message: 'added' })
    }
    if (url.includes('FundMNewApi/FundMNFInfo')) {
      const codes = new URL(url).searchParams.get('Fcodes') || ''
      const Datas = codes.split(',').filter(Boolean).map((c) => {
        const f = localData.quotes.funds[c]
        return f && {
          FCODE: f.code, SHORTNAME: f.name, PDATE: f.jzrq, NAV: String(f.dwjz),
          NAVCHGRT: '0.07', GSZ: String(f.gsz), GSZZL: String(f.gszzl),
          GZTIME: f.gztime, ACCNAV: '3.0050'
        }
      }).filter(Boolean)
      return json({ Datas, ErrCode: 0, Success: true })
    }
    if (url.includes('searchapi.eastmoney.com')) {
      const kw = decodeURIComponent(url.match(/PinYin\/([^/]+)\/true/)?.[1] || '')
      return json({
        Message: '成功',
        Data: [
          { Name: '贵州茅台', Code: '600519', MktNum: '1', SecurityTypeName: '沪A', Classify: 'AStock' },
          { Name: '五 粮 液', Code: '000858', MktNum: '0', SecurityTypeName: '深A', Classify: 'AStock' },
          { Name: '上证指数', Code: '000001', MktNum: '1', SecurityTypeName: '指数', Classify: 'Index' }
        ].filter((x) => kw && (x.Name.includes(kw) || x.Code.includes(kw)))
      })
    }
    if (url.includes('FundSearchAPI.ashx')) {
      const kw = decodeURIComponent(url.match(/key=([^&]*)/)?.[1] || '')
      return json({
        Datas: [
          { FCODE: '110022', SHORTNAME: '易方达消费行业股票' },
          { FCODE: '161725', SHORTNAME: '招商中证白酒指数(LOF)A' }
        ].filter((x) => kw && (x.SHORTNAME.includes(kw) || x.FCODE.includes(kw)))
      })
    }
    return realFetch(url)
  }
  console.log('[mock] chrome API + fetch mock installed')
})()
