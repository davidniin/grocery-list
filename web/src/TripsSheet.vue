<script setup>
// Historial: Compras (importe y foto del ticket, repetir, guardar como plantilla), Plantillas y Estadísticas.
import { ref, computed } from 'vue';
import { S, newId, setTripTotal, uploadReceipt, deleteReceipt, saveTemplate, deleteTemplate } from './sync.js';
import ReceiptThumb from './ReceiptThumb.vue';
import { stats, eur } from './habits.js';

const props = defineProps({ storeName: Function, catIcon: Function, pending: Array });
const emit = defineEmits(['close', 'add', 'remove-trip']);

const tab = ref('trips');
const openId = ref(S.trips[0] ? S.trips[0].id : null);
const toggle = (id) => { openId.value = openId.value === id ? null : id; editTotal.value = null; err.value = ''; };

const when = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);

// ------------------------------------------------------------ compras: importe y ticket
const editTotal = ref(null); // texto mientras se edita
const err = ref('');
const busy = ref(false);
function startTotal(t) { editTotal.value = t.total != null ? String(t.total).replace('.', ',') : ''; }
function saveTotal(t) {
  const s = editTotal.value.trim().replace(',', '.');
  const n = s === '' ? null : +s;
  if (n != null && (!Number.isFinite(n) || n < 0)) return (err.value = 'Importe no válido');
  setTripTotal(t, n == null ? null : Math.round(n * 100) / 100);
  editTotal.value = null;
  err.value = '';
}
async function pickReceipt(t, ev) {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  busy.value = true;
  err.value = '';
  try { await uploadReceipt(t, f); } catch (e) { err.value = e.message; } finally { busy.value = false; }
}
function dropReceipt(t) { if (confirm('¿Borrar la foto del ticket?')) deleteReceipt(t); }
function removeTrip(t) { if (confirm('¿Borrar esta compra del historial?')) emit('remove-trip', t); }

// ------------------------------------------------------------ plantillas
const tplOpen = ref(null);
const slim = (list) => list.map(({ name, cat, qty, store }) => ({ name, cat, qty, store }));
function newTemplate(items, suggested) {
  const name = (prompt('Nombre de la plantilla', suggested || '') || '').trim();
  if (!name) return;
  const tpl = { id: newId(), name, items: slim(items) };
  saveTemplate(tpl);
  tab.value = 'templates';
  tplOpen.value = tpl.id;
}
function renameTemplate(t) {
  const name = (prompt('Nuevo nombre', t.name) || '').trim();
  if (name && name !== t.name) saveTemplate({ ...t, name });
}
function dropFromTemplate(t, i) {
  const items = t.items.filter((x, j) => j !== i);
  saveTemplate({ ...t, items });
}
function removeTemplate(t) { if (confirm('¿Borrar la plantilla «' + t.name + '»?')) deleteTemplate(t); }

// ------------------------------------------------------------ estadísticas
const st = computed(() => stats(S.trips));
const maxSpent = computed(() => Math.max(1, ...st.value.months.map((m) => m.spent)));
const sel = ref(5);
const monthLabel = (d, long) => {
  const s = d.toLocaleDateString('es-ES', long ? { month: 'long', year: 'numeric' } : { month: 'short' }).replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
</script>

<template>
  <div class="sheet-bg" @click.self="emit('close')">
    <div class="sheet trips">
      <div class="trips-head">
        <h2>Historial</h2>
        <button class="link" @click="emit('close')">Cerrar</button>
      </div>
      <nav class="seg">
        <button :class="{ on: tab === 'trips' }" @click="tab = 'trips'">Compras</button>
        <button :class="{ on: tab === 'templates' }" @click="tab = 'templates'">Plantillas</button>
        <button :class="{ on: tab === 'stats' }" @click="tab = 'stats'">Estadísticas</button>
      </nav>

      <!-- ====================================================== compras -->
      <div v-if="tab === 'trips'" class="trips-list">
        <p v-if="!S.trips.length" class="trips-empty">Aún no hay ninguna. Al terminar en el súper, pulsa «Compra finalizada».</p>
        <section v-for="t in S.trips" :key="t.id" class="trip">
          <button class="trip-row" @click="toggle(t.id)">
            <span class="trip-when">{{ when(t.finished_at) }}<small>{{ t.store ? props.storeName(t.store) : 'Todas las tiendas' }} · {{ plural(t.n, 'producto', 'productos') }}</small></span>
            <span v-if="t.receipt" title="Con ticket">🧾</span>
            <b class="trip-total" :class="{ none: t.total == null }">{{ t.total == null ? 'sin importe' : eur(t.total) }}</b>
            <span class="caret" :class="{ open: openId === t.id }">▸</span>
          </button>
          <div v-if="openId === t.id" class="trip-body">
            <ul>
              <li v-for="x in t.items" :key="x.id">
                <span>{{ props.catIcon(x.cat) }}</span>{{ x.name }}<b v-if="x.qty > 1" class="qty">×{{ x.qty }}</b>
              </li>
            </ul>

            <div class="trip-extra">
              <form v-if="editTotal !== null" class="total-edit" @submit.prevent="saveTotal(t)">
                <input v-model="editTotal" type="text" inputmode="decimal" placeholder="0,00 €" autocomplete="off" />
                <button class="primary small">Guardar</button>
                <button type="button" class="link" @click="editTotal = null">Cancelar</button>
              </form>
              <button v-else class="link" @click="startTotal(t)">{{ t.total == null ? '＋ Añadir importe' : '✎ Importe: ' + eur(t.total) }}</button>

              <div class="receipt-pick">
                <ReceiptThumb v-if="t.receipt" :trip="t" />
                <label class="chip-btn" :class="{ busy }">
                  <input type="file" accept="image/*" capture="environment" :disabled="busy" @change="pickReceipt(t, $event)" />
                  {{ busy ? '⏳ Subiendo…' : t.receipt ? '📷 Cambiar ticket' : '📷 Foto del ticket' }}
                </label>
                <button v-if="t.receipt" class="link danger" @click="dropReceipt(t)">Quitar</button>
              </div>
              <p v-if="err" class="sheet-err">{{ err }}</p>
            </div>

            <div class="actions wrap">
              <button class="link danger" @click="removeTrip(t)">Borrar</button>
              <button class="link" @click="newTemplate(t.items)">Guardar como plantilla</button>
              <button class="primary" @click="emit('add', t.items)">Añadir todo a la lista</button>
            </div>
          </div>
        </section>
      </div>

      <!-- ====================================================== plantillas -->
      <div v-else-if="tab === 'templates'" class="trips-list">
        <button class="primary tpl-new" :disabled="!props.pending.length" @click="newTemplate(props.pending)">
          ＋ Nueva plantilla con la lista actual<small>{{ props.pending.length ? plural(props.pending.length, 'producto pendiente', 'productos pendientes') : 'La lista está vacía' }}</small>
        </button>
        <p v-if="!S.templates.length" class="trips-empty">
          Guarda listas que repites («Barbacoa», «Desayunos», «Semana normal») y añádelas de un toque. También desde una
          compra pasada: «Guardar como plantilla».
        </p>
        <section v-for="t in S.templates" :key="t.id" class="trip">
          <button class="trip-row" @click="tplOpen = tplOpen === t.id ? null : t.id">
            <span class="trip-when">📋 {{ t.name }}<small>{{ plural(t.items.length, 'producto', 'productos') }}</small></span>
            <span class="caret" :class="{ open: tplOpen === t.id }">▸</span>
          </button>
          <div v-if="tplOpen === t.id" class="trip-body">
            <ul>
              <li v-for="(x, i) in t.items" :key="i" class="tpl-item">
                <span>{{ props.catIcon(x.cat) }}</span>{{ x.name }}<b v-if="x.qty > 1" class="qty">×{{ x.qty }}</b>
                <button class="tpl-x" :aria-label="'Quitar ' + x.name" @click="dropFromTemplate(t, i)">×</button>
              </li>
            </ul>
            <div class="actions wrap">
              <button class="link danger" @click="removeTemplate(t)">Borrar</button>
              <button class="link" @click="renameTemplate(t)">Renombrar</button>
              <button class="primary" :disabled="!t.items.length" @click="emit('add', t.items)">Añadir a la lista</button>
            </div>
          </div>
        </section>
      </div>

      <!-- ====================================================== estadísticas -->
      <div v-else class="trips-list stats">
        <p v-if="!st.count" class="trips-empty">Las estadísticas salen de las compras finalizadas. Aún no hay ninguna.</p>
        <template v-else>
          <div class="stat-grid">
            <div class="stat"><small>Este mes</small><b>{{ st.hasTotals ? eur(st.thisMonth.spent) : '—' }}</b><span>{{ plural(st.thisMonth.trips, 'compra', 'compras') }}</span></div>
            <div class="stat"><small>Mes pasado</small><b>{{ st.hasTotals ? eur(st.lastMonth.spent) : '—' }}</b><span>{{ plural(st.lastMonth.trips, 'compra', 'compras') }}</span></div>
            <div class="stat"><small>Media al mes</small><b>{{ eur(st.avgMonth) }}</b></div>
            <div class="stat"><small>Por compra</small><b>{{ eur(st.avgTrip) }}</b></div>
          </div>
          <p class="stat-note">
            <template v-if="st.every">Vas a comprar <b>cada {{ plural(Math.round(st.every), 'día', 'días') }}</b> de media.</template>
            <template v-if="!st.hasTotals"> Apunta el importe al finalizar para ver cuánto gastas.</template>
          </p>

          <template v-if="st.hasTotals">
            <h3>Gasto de los últimos 6 meses</h3>
            <div class="chart">
              <div class="chart-head">
                <b>{{ monthLabel(st.months[sel].date, true) }}</b>
                <span>{{ eur(st.months[sel].spent) }} · {{ plural(st.months[sel].trips, 'compra', 'compras') }}</span>
              </div>
              <div class="bars" role="img" :aria-label="'Gasto por mes, máximo ' + eur(maxSpent)">
                <span class="bars-max">{{ eur(maxSpent) }}</span>
                <button v-for="(m, i) in st.months" :key="m.key" class="col" :class="{ on: i === sel }" :aria-label="monthLabel(m.date, true) + ': ' + eur(m.spent)" @click="sel = i">
                  <span class="stack"><i v-if="m.spent" class="bar-fill" :style="{ height: (m.spent / maxSpent) * 100 + '%' }"></i></span>
                  <small>{{ monthLabel(m.date) }}</small>
                </button>
              </div>
            </div>
          </template>

          <h3>Por tienda</h3>
          <div v-for="s in st.stores" :key="s.store || 'all'" class="rank-row">
            <span>{{ s.store ? props.storeName(s.store) : 'Todas las tiendas' }}</span>
            <small>{{ plural(s.trips, 'compra', 'compras') }}</small>
            <b>{{ st.hasTotals ? eur(s.spent) : '' }}</b>
          </div>

          <h3>Lo que más compras</h3>
          <div v-for="(p, i) in st.top" :key="p.name" class="rank-row">
            <span>{{ i + 1 }}. {{ props.catIcon(p.cat) }} {{ p.name }}</span>
            <small></small>
            <b>{{ plural(p.times, 'vez', 'veces') }}</b>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
