<script setup>
import { ref, watch } from 'vue'
import { searchStocks, searchFunds } from '../../shared/api.js'

const props = defineProps({ kind: { type: String, required: true } })
const emit = defineEmits(['add'])

const q = ref('')
const results = ref([])
const busy = ref(false)

let timer = null
let blurTimer = null
watch(q, (v) => {
  clearTimeout(timer)
  if (!v.trim()) {
    results.value = []
    return
  }
  busy.value = true
  timer = setTimeout(async () => {
    try {
      results.value =
        props.kind === 'stock' ? await searchStocks(v.trim()) : await searchFunds(v.trim())
    } catch {
      results.value = []
    }
    busy.value = false
  }, 300)
})
watch(
  () => props.kind,
  () => {
    q.value = ''
    results.value = []
  }
)

const onBlur = () => {
  clearTimeout(blurTimer)
  blurTimer = setTimeout(() => (results.value = []), 150)
}

const pick = (item) => {
  emit('add', item)
  q.value = ''
  results.value = []
}
</script>

<template>
  <div class="search">
    <input
      v-model="q"
      :placeholder="kind === 'stock' ? '搜索代码 / 名称 / 拼音 添加自选…' : '搜索基金代码 / 名称…'"
      @keydown.esc="results = []"
      @blur="onBlur"
    />
    <span v-if="busy" class="hint">…</span>
    <div v-if="results.length" class="drop">
      <div v-for="r in results" :key="`${r.market || ''}.${r.code}`" class="row" @mousedown.prevent="pick(r)">
        <span class="name">{{ r.name }}</span>
        <span class="code">{{ r.code }}</span>
        <span class="type">{{ r.StockType }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search { position: relative; padding: 6px 8px; flex: none; }
input {
  width: 100%;
  padding: 5px 9px;
  font: inherit;
  color: var(--fg);
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 5px;
}
input:focus { border-color: var(--accent); outline: none; }
.hint { position: absolute; right: 18px; top: 12px; color: var(--fg2); }
.drop {
  position: absolute;
  z-index: 30;
  left: 8px;
  right: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  max-height: 240px;
  overflow-y: auto;
}
.row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 6px 10px;
  cursor: pointer;
}
.row:hover { background: var(--hover); }
.name { flex: 1; }
.code { color: var(--fg2); font-size: 0.9em; }
.type { color: var(--fg2); font-size: 0.8em; }
</style>
