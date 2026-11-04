<script setup>
// Tiendas: añadir, renombrar y borrar. Cada tienda tiene su pestaña en la lista. Los nombres no se traducen.
import { ref } from 'vue';
import { saveStore, deleteStore } from './sync.js';
import { t } from './i18n/index.js';

const props = defineProps({ stores: Array, items: Array });
const emit = defineEmits(['close', 'created']);

const name = ref('');
const err = ref('');
const pending = (id) => props.items.filter((x) => !x.done && x.store === id).length;

function create() {
  const r = saveStore(name.value);
  err.value = r.error || '';
  if (r.store) { name.value = ''; emit('created', r.store); }
}
function rename(s) {
  const n = (prompt(t('stores.renamePrompt'), s.name) || '').trim();
  if (!n || n === s.name) return;
  err.value = saveStore(n, s).error || '';
}
function drop(s) {
  if (!confirm(t('stores.confirmDelete', { name: s.name }))) return;
  err.value = deleteStore(s).error || '';
}
</script>

<template>
  <div class="sheet-bg" @click.self="emit('close')">
    <div class="sheet">
      <div class="trips-head">
        <h2>{{ t('stores.title') }}</h2>
        <button class="link" @click="emit('close')">{{ t('common.close') }}</button>
      </div>
      <p class="sheet-sub">{{ t('stores.lead') }}</p>

      <div v-for="s in stores" :key="s.id" class="store-row">
        <span class="store-name">{{ s.name }}<small>{{ t('stores.pending', { n: pending(s.id) }) }}</small></span>
        <button class="link" @click="rename(s)">{{ t('stores.rename') }}</button>
        <button v-if="stores.length > 1" class="link danger" @click="drop(s)">{{ t('common.delete') }}</button>
      </div>

      <form class="store-new" @submit.prevent="create">
        <input v-model="name" type="text" maxlength="40" :placeholder="t('stores.namePh')" autocomplete="off" autocapitalize="words" />
        <button class="primary" :disabled="!name.trim()">{{ t('stores.add') }}</button>
      </form>
      <p v-if="err" class="sheet-err">{{ err }}</p>
    </div>
  </div>
</template>
