# 盯盘助手 Lite

轻量级股票基金盯盘 Chrome 扩展（Manifest V3 + Vue3 重写版），复刻自「股票基金助手 - 盯盘助手 3.3.0」的核心功能并做了定制增强。

**构建产物约 130KB（原版 6.7MB，减重 98%），无 UI 框架、无埋点、无第三方上报、仅本地存储。**

## 功能

- **自选股 / 基金分组管理**：≤15 组，每组 ≤50 个自选，置顶 / 删除 / 双击重命名
- **实时行情**：东方财富公开接口，popup 打开期间按可配置间隔（5~120 秒）轮询；停牌识别、美股/港股标签
- **持仓收益**：行内编辑持仓价 / 持仓数（份额），实时计算当天收益、总收益、收益率、持仓金额；汇总条 + 角标（当日收益额 / 收益率，红涨绿跌，美股港股按可配置汇率折算）
- **价格提醒**：个股 4 类（涨到 / 跌到 X 元、日涨幅 / 跌幅超 X%），基金 2 类（估算涨 / 跌幅超 X%）；仅 A 股交易时段触发；**触发后可自动停用（防轰炸，原版没有）**；交易日 14:40 补仓提醒
- **分时迷你图**：个股行内展开当日分时（东财 trends2 接口）；基金展示当日估算涨跌幅采样曲线（本地累积）
- **界面**：真·深色主题（CSS 变量，非滤镜反色）、字号 / 透明度 / 表格列可配置、顶部大盘指数条可增删
- **数据备份**：一键导出 / 导入 JSON；**兼容旧插件「数据文件备份」导出格式**（自动映射 stockGroup / config / stock_notice 等旧字段）
- **做T终端联动**：与本地「做T全能终端」（zuot-terminal，Wails 版 v1.2.1+）联动——插件只读其持仓成本，实时显示每只股的做T浮动盈亏与汇总（不需要在插件里重复填持仓）

## 与原版的差异

| 项 | 原版 3.3.0 | 本版 |
|---|---|---|
| Manifest | V2（新版 Chrome 已停用） | V3 |
| 体积 | 6.7MB | ~130KB |
| 云备份/账号 | 绑定作者服务器 topnamei.top | 本地 JSON 导入导出 |
| 埋点 | TalkingData + unsafe-eval | 无 |
| 提醒触发后 | 每分钟重复响，手动关 | 可自动停用 |
| 基金提醒 | 不支持 | 支持（估算涨跌幅） |
| 刷新间隔 | 固定 15 秒 | 5~120 秒可配 |
| 暗黑主题 | CSS filter 反色 | CSS 变量真暗黑 |
| 详情页 | 内嵌 iframe 页 | 直跳东财网页 |

## 安装（加载已解压扩展）

1. 打开浏览器扩展管理页：`chrome://extensions`（Edge：`edge://extensions`；本次适配的浏览器同样在设置里搜「扩展」）
2. 开启右上角**开发者模式**
3. 点击**加载已解压的扩展程序**，选择本项目的 `dist/` 目录
4. 工具栏出现图标即安装成功。建议「固定」到工具栏

> 更新代码后：`npm run build`，然后在扩展管理页点击该扩展的 ↻ 刷新按钮。

## 开发

```bash
npm install
npm run build     # 一次性构建到 dist/
npm run dev       # watch 模式，改码后自动重建（仍需手动刷新扩展）
npm run api-test  # curl 实测东财各接口连通性
```

### Mock 冒烟测试（无需装扩展即可看 UI）

`test/` 目录带了一套 chrome API + 东财接口的 mock：

```bash
npm run build && cp -r test dist/
cd dist && python3 -m http.server 8901
# 浏览器打开 http://127.0.0.1:8901/test/index.html   （popup）
#             http://127.0.0.1:8901/test/options.html （设置页）
```

## 做T终端联动

「做T全能终端」（Wails v2 桌面应用）加入联动版补丁后内置本机 API（`apiServer.go`，仅监听 127.0.0.1、校验 Host 防DNS重绑定）：

- 默认端口 `27518`，可用 `zuot-terminal -api-port 12345` 改，`-api-port 0` 关闭
- `GET /api/health` → `{ok, app, version}`（联动探测）
- `GET /api/state` → 完整 data.json（settings / stocks（含 baseCost/baseQty/currCost/currQty/history）/ finance）
- `POST /api/stock` `{code, name}` → 把个股加入做T持仓（**读通道+写通道都有**；写操作由做T终端前端统一落盘，Go 仅转发事件，3 秒回执超时）

插件侧：设置页「做T终端联动」开启并填端口 →
1. **读**：后台轮询时自动把做T持仓合并进行情请求 → popup 顶部「做T」条（每只股实时浮动 + 总浮动，零仓位条目显示灰色「未填仓位」），自选表内该股打「做T ±金额」标签
2. **写**：自选行点「T」→ 行内填成本价/持仓数 → 同步 → 做T终端收到完整持仓（toast 确认）；对已存在的零仓位条目再点 T 可补填

安全边界：只监听回环地址；Host 头校验挡 DNS 重绑定；写通道仅接受 6 位 A 股代码、由前端单写入者落盘。

## 数据结构（chrome.storage.local）

> 存储后端说明：用户数据存 **local** 而非 sync——Helium 等去 Google 化 Chromium 分支的 storage.sync 后端不可用，写入会静默丢失（实测确认）。local 配额 10MB，体量无压力。若曾在正常 Chrome 上用 sync 存过数据，新版会自动迁移一次。

```
stockGroups: [{ id, name, items: [{ code, name, market, StockType, initPrice?, num?, isTodybuy? }] }]
fundGroups:  [{ id, name, items: [{ code, name, cost?, num? }] }]
curStockGroupId / curFundGroupId
indexItems:  [{ name, code, market }]        # market: 1=沪 0=深（东财 MktNum）
settings:    { refreshSec, badgeModel('0'|'1'|'2'), isDark, showIndexBar, fontSize, opacity,
               usRate, hkRate, noticeAutoOff, fundNotice, replenishmentNotice,
               stockColumns: {...}, fundColumns: {...} }
notices:     [{ id, kind('stock'|'fund'), marketCode|code, name, type('1'|'2'|'3'|'4'),
                value, describe, status }]
```

行情缓存（chrome.storage.local）：`quotes = { stocks: {secid:…}, funds: {code:…}, sparkline: {code:[…]}, updatedAt }`。

## 数据源（东方财富公开接口，2026-11 实测）

| 用途 | 接口 |
|---|---|
| 股票/指数行情 | `push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f12,f13,f14,f2,f3,f4,f8,f18&secids=…` |
| 基金净值/估值 | `fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?...&Fcodes=…`（裸请求即可；`fundgz.1234567.cn` 已失效） |
| 股票/指数搜索 | `searchapi.eastmoney.com/api/Info/Search?...` |
| 基金搜索 | `fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=9&key=…` |
| 个股分时 | `push2.eastmoney.com/api/qt/stock/trends2/get?secid=…&ndays=1` |

## MV3 架构要点

- **双模式轮询**：popup 打开时经 `chrome.runtime.connect` 长端口 + 20s 心跳保活 service worker，按 `refreshSec` 循环拉行情；popup 关闭后 SW 空闲被杀，由 `chrome.alarms` 每分钟唤醒，仅在交易时段刷新（角标 + 提醒检查）
- 交易时段判断：东八区周一~五 9:29-11:31 / 13:00-15:01（与原版一致，无节假日表）
- 提醒通知 id = 分钟桶 + code，同一分钟内去重

## 已知取舍

- 旧插件的账号云备份、推广页、TalkingData 均不再保留
- 交易时段判断不含法定节假日（原版同样没有）
- 基金迷你图依赖本地轮询采样，刚添加的基金要等盘中累积几个点后才出曲线
- 收益数据仅供参考，不构成投资建议
