<script setup>
// Ficha de un producto: nombre, cantidad, tienda, categoría y nota. Solo envía lo que ha cambiado.
// Desde aquí también se puede crear una tienda nueva ("＋ Nueva") y dejarla elegida.
import { reactive, ref } from 'vue';
import { saveStore } from './sync.js';
import { t, catLabel } from './i18n/index.js';

const props = defineProps({ item: Object, meta: Object });
const emit = defineEmits(['close', 'save', 'remove']);
const f = reactive({ name: props.item.name, qty: props.item.qty, store: props.item.store, cat: props.item.cat, note: props.item.note || '' });
const cats = props.meta.cats.concat(['Otros']).concat(props.meta.cats.includes(props.item.cat) || props.item.cat === 'Otros' ? [] : [props.item.cat]);
const err = ref('');

// Al abrirla manteniendo pulsado, el clic de soltar el dedo cae en el fondo: no debe cerrarla
const openedAt = Date.now();
function backdrop() { if (Date.now() - openedAt > 500) emit('close'); }

function newStore() {
  const name = (prompt(t('stores.newPrompt')) || '').trim();
  if (!name) return;
  const r = saveStore(name);
  err.value = r.error || '';
  if (r.store) f.store = r.store.id;
}

function save() {
  const out = {};
  f.name = f.name.trim() || props.item.name;
  Object.keys(f).forEach((k) => { if (f[k] !== (props.item[k] ?? '')) out[k] = f[k]; });
  if (Object.keys(out).length) emit('save', out);
  else emit('close');
}
</script>

<template>
  <div class="sheet-bg" @click.self="backdrop">
    <form class="sheet" @submit.prevent="save">
      <label>{{ t('edit.product') }}<input v-model="f.name" type="text" /></label>

      <div class="field">
        <span>{{ t('edit.qty') }}</span>
        <div class="stepper">
          <button type="button" :aria-label="t('edit.less')" @click="f.qty = Math.max(1, f.qty - 1)">−</button>
          <b>{{ f.qty }}</b>
          <button type="button" :aria-label="t('edit.more')" @click="f.qty++">+</button>
        </div>
      </div>

      <div class="field">
        <span>{{ t('edit.store') }}</span>
        <div class="chips">
          <button v-for="s in meta.stores" :key="s.id" type="button" :class="{ on: f.store === s.id }" @click="f.store = s.id">{{ s.name }}</button>
          <button type="button" class="chip-new" @click="newStore">{{ t('stores.new') }}</button>
        </div>
      </div>
      <p v-if="err" class="sheet-err">{{ err }}</p>

      <label>{{ t('edit.aisle') }}
        <select v-model="f.cat"><option v-for="c in cats" :key="c" :value="c">{{ catLabel(c) }}</option></select>
      </label>
      <label>{{ t('edit.note') }}<input v-model="f.note" type="text" :placeholder="t('edit.notePh')" /></label>

      <div class="actions">
        <button type="button" class="link danger" @click="emit('remove')">{{ t('common.delete') }}</button>
        <button type="button" class="link" @click="emit('close')">{{ t('common.cancel') }}</button>
        <button class="primary">{{ t('common.save') }}</button>
      </div>
    </form>
  </div>
</template>
