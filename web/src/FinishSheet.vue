<script setup>
// "Compra finalizada": importe y foto del ticket, ambos opcionales (se pueden poner luego desde el historial).
import { ref, computed, onBeforeUnmount } from 'vue';

defineProps({ n: Number, left: Number, where: String });
const emit = defineEmits(['close', 'finish']);

const total = ref('');
const file = ref(null);
const preview = computed(() => (file.value ? URL.createObjectURL(file.value) : ''));
onBeforeUnmount(() => { if (preview.value) URL.revokeObjectURL(preview.value); });
const err = ref('');

function pick(ev) { file.value = ev.target.files[0] || null; ev.target.value = ''; }
function submit() {
  const s = String(total.value).trim().replace(',', '.');
  const n = s === '' ? null : +s;
  if (n != null && (!Number.isFinite(n) || n < 0)) return (err.value = 'Importe no válido');
  emit('finish', { total: n == null ? null : Math.round(n * 100) / 100, file: file.value });
}
</script>

<template>
  <div class="sheet-bg" @click.self="emit('close')">
    <form class="sheet" @submit.prevent="submit">
      <h2 class="sheet-title">✓ Compra finalizada</h2>
      <p class="sheet-sub">
        {{ n }} {{ n === 1 ? 'producto' : 'productos' }} al historial{{ where ? ' · ' + where : '' }}.
        <template v-if="left">{{ left === 1 ? '1 pendiente se queda' : left + ' pendientes se quedan' }} en la lista.</template>
      </p>
      <label>¿Cuánto ha sido? (opcional)
        <input v-model="total" type="text" inputmode="decimal" placeholder="0,00 €" autocomplete="off" />
      </label>
      <div class="field">
        <span>Foto del ticket (opcional)</span>
        <div class="receipt-pick">
          <img v-if="preview" :src="preview" alt="Ticket" />
          <label class="chip-btn">
            <input type="file" accept="image/*" capture="environment" @change="pick" />
            {{ file ? '📷 Cambiar foto' : '📷 Hacer foto' }}
          </label>
          <button v-if="file" type="button" class="link danger" @click="file = null">Quitar</button>
        </div>
      </div>
      <p v-if="err" class="sheet-err">{{ err }}</p>
      <div class="actions">
        <button type="button" class="link" @click="emit('close')">Cancelar</button>
        <button class="primary">Finalizar</button>
      </div>
    </form>
  </div>
</template>
