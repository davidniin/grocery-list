<script setup>
// Ficha de un producto: nombre, cantidad, tienda, categoría y nota. Solo envía lo que ha cambiado.
import { reactive } from 'vue';

const props = defineProps({ item: Object, meta: Object });
const emit = defineEmits(['close', 'save', 'remove']);
const f = reactive({ name: props.item.name, qty: props.item.qty, store: props.item.store, cat: props.item.cat, note: props.item.note || '' });
const cats = props.meta.cats.concat(['Otros']).concat(props.meta.cats.includes(props.item.cat) || props.item.cat === 'Otros' ? [] : [props.item.cat]);

// Al abrirla manteniendo pulsado, el clic de soltar el dedo cae en el fondo: no debe cerrarla
const openedAt = Date.now();
function backdrop() { if (Date.now() - openedAt > 500) emit('close'); }

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
      <label>Producto<input v-model="f.name" type="text" /></label>

      <div class="field">
        <span>Cantidad</span>
        <div class="stepper">
          <button type="button" aria-label="Menos" @click="f.qty = Math.max(1, f.qty - 1)">−</button>
          <b>{{ f.qty }}</b>
          <button type="button" aria-label="Más" @click="f.qty++">+</button>
        </div>
      </div>

      <div class="field">
        <span>Tienda</span>
        <div class="chips">
          <button v-for="s in meta.stores" :key="s.id" type="button" :class="{ on: f.store === s.id }" @click="f.store = s.id">{{ s.name }}</button>
        </div>
      </div>

      <label>Pasillo
        <select v-model="f.cat"><option v-for="c in cats" :key="c" :value="c">{{ c }}</option></select>
      </label>
      <label>Nota<input v-model="f.note" type="text" placeholder="Marca, tamaño…" /></label>

      <div class="actions">
        <button type="button" class="link danger" @click="emit('remove')">Borrar</button>
        <button type="button" class="link" @click="emit('close')">Cancelar</button>
        <button class="primary">Guardar</button>
      </div>
    </form>
  </div>
</template>
