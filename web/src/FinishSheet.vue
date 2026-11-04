<script setup>
// "Compra finalizada": importe y foto del ticket, ambos opcionales (se pueden poner luego desde el historial).
import { ref, computed, onBeforeUnmount } from 'vue';
import { t } from './i18n/index.js';

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
  if (n != null && (!Number.isFinite(n) || n < 0)) return (err.value = t('common.badAmount'));
  emit('finish', { total: n == null ? null : Math.round(n * 100) / 100, file: file.value });
}
</script>

<template>
  <div class="sheet-bg" @click.self="emit('close')">
    <form class="sheet" @submit.prevent="submit">
      <h2 class="sheet-title">{{ t('fin.title') }}</h2>
      <p class="sheet-sub">
        {{ t('fin.toHistory', { n }) }}{{ where ? ' · ' + where : '' }}.
        <template v-if="left">{{ t('fin.left', { n: left }) }}</template>
      </p>
      <label>{{ t('fin.howMuch') }}
        <input v-model="total" type="text" inputmode="decimal" :placeholder="t('common.amountPh')" autocomplete="off" />
      </label>
      <div class="field">
        <span>{{ t('fin.photo') }}</span>
        <div class="receipt-pick">
          <img v-if="preview" :src="preview" :alt="t('receipt.alt')" />
          <label class="chip-btn">
            <input type="file" accept="image/*" capture="environment" @change="pick" />
            {{ file ? t('fin.changePhoto') : t('fin.takePhoto') }}
          </label>
          <button v-if="file" type="button" class="link danger" @click="file = null">{{ t('common.remove') }}</button>
        </div>
      </div>
      <p v-if="err" class="sheet-err">{{ err }}</p>
      <div class="actions">
        <button type="button" class="link" @click="emit('close')">{{ t('common.cancel') }}</button>
        <button class="primary">{{ t('fin.finish') }}</button>
      </div>
    </form>
  </div>
</template>
