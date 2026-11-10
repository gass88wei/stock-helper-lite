import { createApp, h, Suspense } from 'vue'
import App from './App.vue'
import './style.css'

// App 使用顶层 await 加载存储，需要 Suspense 包裹
createApp({
  setup: () => () => h(Suspense, null, { default: () => h(App) })
}).mount('#app')
