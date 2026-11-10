import { createApp, h, Suspense } from 'vue'
import App from './App.vue'
import '../popup/style.css'

createApp({
  setup: () => () => h(Suspense, null, { default: () => h(App) })
}).mount('#app')
