<script setup>
import { ref } from 'vue'
import { STOCK_NOTICE_TYPES, FUND_NOTICE_TYPES } from '../../shared/defaults.js'

const props = defineProps({
  kind: { type: String, required: true }, // stock | fund
  item: { type: Object, required: true },
  notices: { type: Array, default: () => [] }
})
const emit = defineEmits(['save', 'close'])

const types = props.kind === 'stock' ? STOCK_NOTICE_TYPES : FUND_NOTICE_TYPES
const keyMatch = (n) =>
  props.kind === 'stock'
    ? n.kind === 'stock' && n.marketCode === `${props.item.market}.${props.item.code}`
    : n.kind === 'fund' && n.code === props.item.code

const rows = ref(
  types.map(([type, label]) => {
    const exist = props.notices.find((n) => keyMatch(n) && n.type === type)
    return {
      id: exist?.id,
      type,
      label,
      value: exist?.value ?? '',
      describe: exist?.describe ?? '',
      status: exist ? !!exist.status : true
    }
  })
)

// value 留空 = 删除该类提醒
const save = () =>
  emit(
    'save',
    rows.value.map(({ id, type, value, describe, status }) => ({ id, type, value, describe, status }))
  )
</script>

<template>
  <div class="pop" @click.stop>
    <div v-for="r in rows" :key="r.type" class="row">
      <label class="l">{{ r.label }}</label>
      <input class="cell-input" v-model="r.value" placeholder="阈值" />
      <input class="desc" v-model="r.describe" placeholder="通知文案（可空）" />
      <input type="checkbox" v-model="r.status" title="启用" />
    </div>
    <div class="foot">
      <span class="hint">阈值留空表示删除该条提醒</span>
      <button @click="emit('close')">取消</button>
      <button class="primary" @click="save">保存</button>
    </div>
  </div>
</template>

<style scoped>
.pop {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  margin: 2px 4px;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.l { width: 110px; color: var(--fg); white-space: nowrap; }
.desc { flex: 1; }
input.cell-input,
.desc {
  padding: 3px 6px;
  font: inherit;
  color: var(--fg);
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
}
.foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.hint { color: var(--fg2); font-size: 0.8em; margin-right: auto; }
.foot button { padding: 3px 12px; border: 1px solid var(--border); border-radius: 4px; }
.foot button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
</style>
