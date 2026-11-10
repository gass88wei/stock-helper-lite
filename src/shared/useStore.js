// Vue 响应式用户数据 store（仅 popup / options 使用）
import { reactive, watch } from 'vue'
import { loadAll, saveSync } from './store.js'

let statePromise = null

// 单例：加载用户数据为响应式对象，变更立即写盘（无防抖），写完立即广播。
// 历史教训：防抖 + 延迟广播会让先开的页面揣着旧状态，把新页面写入的数据覆盖掉。
export function useStore() {
  if (!statePromise) {
    statePromise = loadAll().then((data) => {
      const state = reactive(data)
      let saving = false
      let dirty = false
      let refreshing = false // 拉取远端数据触发的 watch 不回写，防止 A写→B刷→B写→A刷 死循环
      const persist = () => {
        if (refreshing) return
        if (saving) {
          dirty = true
          return
        }
        saving = true
        saveSync({
          stockGroups: state.stockGroups,
          fundGroups: state.fundGroups,
          curStockGroupId: state.curStockGroupId,
          curFundGroupId: state.curFundGroupId,
          indexItems: state.indexItems,
          settings: state.settings,
          notices: state.notices
        }).finally(() => {
          saving = false
          if (dirty) {
            dirty = false
            persist()
            return
          }
          // 写完立刻广播（不延迟）：其它页面/后台马上拿到最新数据
          chrome.runtime.sendMessage({ type: 'store-updated' }).catch(() => {})
        })
      }
      watch(state, persist, { deep: true })

      // 兜底：页面关闭/隐藏前把未落盘的变更强制写出
      const flush = () => persist()
      window.addEventListener('pagehide', flush)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) flush()
      })

      // 其它页面改了数据（popup ↔ options）时拉取最新；窗口重新聚焦也拉一次
      const refresh = () => {
        refreshing = true
        return loadAll()
          .then((d) => Object.assign(state, d))
          .finally(() => setTimeout(() => (refreshing = false), 0))
      }
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === 'store-updated') refresh()
      })
      window.addEventListener('focus', refresh)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refresh()
      })
      return state
    })
  }
  return statePromise
}

// 兼容旧调用点：数据变更后的广播已由 persist 统一处理，这里保留空实现
export function notifyStoreChanged() {}
