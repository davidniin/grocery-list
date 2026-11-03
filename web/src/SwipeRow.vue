<script setup>
// Fila con gestos: tocar, deslizar a la derecha (`right`), a la izquierda (`left`) y mantener pulsado (`hold`).
// El scroll vertical lo sigue haciendo el navegador (touch-action: pan-y); aquí solo se mira el horizontal.
import { ref } from 'vue';
import { buzz } from './buzz.js';

const props = defineProps({ right: String, left: String }); // texto de cada acción; sin texto, no hay gesto
const emit = defineEmits(['tap', 'right', 'left', 'hold']);

const LIMIT = 90; // px a partir de los que soltar ejecuta la acción
const dx = ref(0);
const dragging = ref(false);
let id = null, x0 = 0, y0 = 0, axis = null, held = false, holdTimer = null, leaving = false;

function down(e) {
  if (e.button > 0 || leaving) return;
  id = e.pointerId; x0 = e.clientX; y0 = e.clientY; axis = null; held = false;
  holdTimer = setTimeout(() => { held = true; buzz(15); emit('hold'); }, 500);
}
function move(e) {
  if (e.pointerId !== id) return;
  const mx = e.clientX - x0, my = e.clientY - y0;
  if (!axis && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
    clearTimeout(holdTimer);
    axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
    if (axis === 'x') { dragging.value = true; e.currentTarget.setPointerCapture(id); }
  }
  if (axis !== 'x') return;
  // Sin acción en ese lado: se mueve poco, con resistencia
  dx.value = (mx > 0 && !props.right) || (mx < 0 && !props.left) ? mx / 5 : mx;
}
function up(e) {
  if (e.pointerId !== id) return;
  clearTimeout(holdTimer);
  id = null;
  dragging.value = false;
  if (axis === 'x' && dx.value > LIMIT && props.right) return out(1, 'right');
  if (axis === 'x' && dx.value < -LIMIT && props.left) return out(-1, 'left');
  dx.value = 0;
  if (!axis && !held) emit('tap');
}
function cancel() {
  clearTimeout(holdTimer);
  id = null;
  dragging.value = false;
  dx.value = 0;
}
// Sale de la pantalla y luego avisa. Si la fila sigue ahí después (p. ej. se deshizo), vuelve a su sitio.
function out(dir, ev) {
  leaving = true;
  buzz(10);
  dx.value = dir * window.innerWidth;
  setTimeout(() => emit(ev), 160);
  setTimeout(() => { leaving = false; dx.value = 0; }, 700);
}
</script>

<template>
  <div class="swipe" :class="{ dragging }">
    <div v-if="right" class="swipe-bg is-right" :style="{ opacity: dx > 0 ? Math.min(1, dx / LIMIT) : 0 }">✓ {{ right }}</div>
    <div v-if="left" class="swipe-bg is-left" :style="{ opacity: dx < 0 ? Math.min(1, -dx / LIMIT) : 0 }">{{ left }} ✕</div>
    <div
      class="row"
      :style="dx ? { transform: 'translateX(' + dx + 'px)' } : null"
      @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="cancel" @contextmenu.prevent
    >
      <slot />
    </div>
  </div>
</template>
