<script setup>
defineProps({
  groups: { type: Array, required: true },
  modelValue: { type: String, default: '' },
  kind: { type: String, required: true } // stock | fund
})
const emit = defineEmits(['update:modelValue', 'add', 'rename', 'del'])
</script>

<template>
  <div class="group-tabs">
    <div
      v-for="g in groups"
      :key="g.id"
      class="g"
      :class="{ active: g.id === modelValue }"
      @click="emit('update:modelValue', g.id)"
      @dblclick="emit('rename', kind, g)"
    >
      {{ g.name }}<i>{{ g.items.length }}</i>
      <span v-if="g.id === modelValue && groups.length > 1" class="x" title="删除分组" @click.stop="emit('del', kind, g)">✕</span>
    </div>
    <button class="add" title="新建分组" @click="emit('add', kind)">＋</button>
  </div>
</template>

<style scoped>
.group-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px 0;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  flex: none;
}
.g {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 9px;
  border-radius: 5px 5px 0 0;
  color: var(--fg2);
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid transparent;
  border-bottom: none;
}
.g:hover { color: var(--fg); background: var(--hover); }
.g.active {
  color: var(--accent);
  background: var(--bg);
  border-color: var(--border);
  font-weight: 600;
}
.g i { font-style: normal; font-size: 0.8em; opacity: 0.7; }
.x { color: var(--fg2); font-size: 10px; padding: 0 2px; border-radius: 3px; }
.x:hover { color: var(--up); }
.add { color: var(--fg2); padding: 4px 8px; }
.add:hover { color: var(--accent); }
</style>
