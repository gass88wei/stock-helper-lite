// 默认配置与数据结构（对齐原插件 3.3.0 的语义，键名重新设计）

export const DEFAULT_INDICES = [
  { name: '上证指数', code: '000001', market: '1' },
  { name: '沪深300', code: '000300', market: '1' },
  { name: '深证成指', code: '399001', market: '0' },
  { name: '创业板指', code: '399006', market: '0' }
]

// 列配置：field -> [中文列名, 默认是否显示]
export const STOCK_COLUMNS = {
  price: ['市价', true],
  zdf: ['涨跌幅', true],
  zdfPrice: ['涨跌额', true],
  initPrice: ['持仓价', false],
  num: ['持仓数', false],
  ccje: ['持仓金额', false],
  hsl: ['换手率', false],
  dtsy: ['当天收益', false],
  zsyl: ['收益率', false],
  zsy: ['总收益', false]
}

export const FUND_COLUMNS = {
  gsz: ['估值', true],
  gszzl: ['涨跌幅', true],
  dwjz: ['最新净值', false],
  cost: ['持仓价', false],
  num: ['持仓数', false],
  cyje: ['持仓金额', false],
  dtsy: ['当天收益', false],
  syl: ['收益率', false],
  zsy: ['总收益', false]
}

export const DEFAULT_SETTINGS = {
  refreshSec: 15, // 轮询间隔（秒），可配 5~120
  badgeModel: '0', // '0' 关闭 / '1' 当日总收益额 / '2' 当日总收益率
  isDark: false,
  showIndexBar: true,
  fontSize: 'normal', // small / normal / large
  opacity: 100, // 界面透明度 %
  usRate: 6.4708, // 美元兑人民币（收益折算，原版默认值，可在设置中改）
  hkRate: 0.8346, // 港元兑人民币
  noticeAutoOff: true, // 提醒触发后自动停用（原版没有，防轰炸）
  fundNotice: true, // 启用基金提醒
  replenishmentNotice: false, // 交易日 14:40 提醒
  zuotLink: false, // 联动本地「做T全能终端」（只读其持仓成本）
  zuotPort: 27518, // 做T联动 API 端口（zuot-terminal -api-port 指定）
  stockColumns: Object.fromEntries(Object.entries(STOCK_COLUMNS).map(([k, [, v]]) => [k, v])),
  fundColumns: Object.fromEntries(Object.entries(FUND_COLUMNS).map(([k, [, v]]) => [k, v]))
}

// 默认自选股（首次安装时预置到“默认分组”）
export const DEFAULT_STOCKS = [
  { code: '600008', name: '宝武股份', market: '1', StockType: '沪A' },
  // 注意：“国泰海通”目前无单独证券代码，国泰君安（601211）与海通证券（600837）
  // 正在吸收合并，合并后大概率以国泰君安代码存续，这里暂用 601211
  { code: '601211', name: '国泰君安', market: '1', StockType: '沪A' }
]

export const DEFAULT_GROUPS = () => [{ id: 'g-default', name: '默认分组', items: [...DEFAULT_STOCKS] }]

export const STOCK_NOTICE_TYPES = [
  ['1', '股价涨到（元）'],
  ['2', '股价跌到（元）'],
  ['3', '日涨幅超过（%）'],
  ['4', '日跌幅超过（%）']
]

export const FUND_NOTICE_TYPES = [
  ['3', '估算涨幅超过（%）'],
  ['4', '估算跌幅超过（%）']
]
