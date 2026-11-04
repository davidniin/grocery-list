<script setup>
// Miniatura de la foto del ticket. Se descarga con fetch (con credenciales en cabecera) y se muestra como blob:;
// al tocarla se abre en grande en otra pestaña.
import { ref, watch, onBeforeUnmount } from 'vue';
import { fetchReceipt } from './sync.js';
import { t } from './i18n/index.js';

const props = defineProps({ trip: { type: Object, required: true } });
const url = ref('');
const failed = ref(false);

function release() {
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = '';
}

watch(() => [props.trip.id, props.trip.receipt], async () => {
  release();
  failed.value = false;
  if (!props.trip.receipt) return;
  try { url.value = URL.createObjectURL(await fetchReceipt(props.trip)); } catch { failed.value = true; }
}, { immediate: true });

onBeforeUnmount(release);
</script>

<template>
  <a v-if="url" :href="url" target="_blank" rel="noopener"><img :src="url" :alt="t('receipt.alt')" /></a>
  <span v-else-if="failed" class="receipt-off">{{ t('receipt.offline') }}</span>
</template>
