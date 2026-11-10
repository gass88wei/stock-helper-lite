// 行情缓存 + 长端口保活（popup 打开期间 background 保持活跃轮询）
import { ref, onUnmounted } from 'vue'
import { getQuotes } from '../shared/store.js'

export async function useQuotes() {
  const quotes = ref(await getQuotes())

  const port = chrome.runtime.connect({ name: 'ui' })
  const onPortMsg = (msg) => {
    if (msg?.type === 'quotes-updated') {
      getQuotes().then((q) => (quotes.value = q))
    }
  }
  port.onMessage.addListener(onPortMsg)

  // 心跳：每 20s 一条消息，重置 SW 30s 空闲计时器
  const pingTimer = setInterval(() => {
    try {
      port.postMessage({ type: 'ping' })
    } catch {
      /* port 已断开 */
    }
  }, 20000)

  const refresh = () => chrome.runtime.sendMessage({ type: 'refresh' }).catch(() => {})

  onUnmounted(() => {
    clearInterval(pingTimer)
    try {
      port.disconnect()
    } catch {
      /* noop */
    }
  })

  return { quotes, refresh }
}
