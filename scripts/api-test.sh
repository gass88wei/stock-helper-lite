#!/usr/bin/env bash
# 东财各接口连通性实测（构建前确认数据源可用）
set -u
pass=0; fail=0
check() { # check <名称> <期望包含> <curl参数...>
  local name="$1" expect="$2"; shift 2
  local out; out=$(curl -s --max-time 12 "$@" 2>&1 | head -c 2000)
  if [[ "$out" == *"$expect"* ]]; then
    echo "[OK]   $name"; pass=$((pass+1))
  else
    echo "[FAIL] $name"; echo "       got: ${out:0:180}"; fail=$((fail+1))
  fi
}

check "股票行情 push2 ulist"        '"f14":"贵州茅台"' 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f12,f13,f14,f2,f3,f4,f8,f18&secids=1.600519,0.000001'
check "指数行情 push2 指数"          '上证指数'          'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f12,f13,f14,f2,f3,f4&secids=1.000001,0.399001,0.399006,1.000300'
# 实测结论（2026-11-07）：fundgz.1234567.cn 已失效；fundmobapi 裸请求即可用，无需伪造请求头
check "基金接口 fundmobapi (主用)"    'Datas'             'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=200&plat=Android&appType=ttjj&product=EFund&Version=1&deviceid=8F3A1B2C-D4E5-F6A7-B8C9-D0E1F2A3B4C5&Fcodes=110022,161725'
check "股票搜索 searchapi"           '成功'              'https://searchapi.eastmoney.com/api/Info/Search?appid=el1902262&type=14&token=CCSDCZSDCXYMYZYYSYYXSMDDSMDHHDJT&and14=MultiMatch%2FName%2CCode%2CPinYin%2F%E8%8C%85%E5%8F%B0%2Ftrue&returnfields14=Name%2CCode%2CPinYin%2CMarketType%2CJYS%2CMktNum%2CClassify%2CSecurityTypeName&pageIndex14=1&pageSize14=10&isAssociation14=false'
check "基金搜索 fundsuggest"         'Datas'             'https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=9&key=%E6%98%93%E6%96%B9%E8%BE%BE'
check "分时 trends2"                 '"prePrice"'        'https://push2.eastmoney.com/api/qt/stock/trends2/get?secid=1.600519&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f53,f56,f58&iscr=0&iscca=0&ndays=1&ut=f057cbcbce2a86e2866ab8877db1d059&forcect=1'

echo "----"
echo "pass=$pass fail=$fail"
