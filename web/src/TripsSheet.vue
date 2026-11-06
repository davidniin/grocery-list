<script setup>
// Historial: Compras (importe y foto del ticket, repetir, guardar como plantilla), Plantillas y Estadísticas.
import { ref, computed } from 'vue';
import { S, newId, setTripTotal, uploadReceipt, deleteReceipt, saveTemplate, deleteTemplate } from './sync.js';
import ReceiptThumb from './ReceiptThumb.vue';
import { stats, eur as euro } from './habits.js';
import { t, locale } from './i18n/index.js';

const props = defineProps({ storeName: Function, pending: Array });
const emit = defineEmits(['close', 'add', 'remove-trip']);

const tab = ref('trips');
const openId = ref(S.trips[0] ? S.trips[0].id : null);
const toggle = (id) => { openId.value = openId.value === id ? null : id; editTotal.value = null; err.value = ''; };

const when = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
};
const plural = (n, key) => t(key, { n });
const eur = (n) => euro(n, locale());
const storeLabel = (id) => (id && props.storeName(id)) || t('store.allLong');

// ------------------------------------------------------------ compras: importe y ticket
const editTotal = ref(null); // texto mientras se edita
const err = ref('');
const busy = ref(false);
function startTotal(tr) { editTotal.value = tr.total != null ? String(tr.total).replace('.', ',') : ''; }
function saveTotal(tr) {
  const s = editTotal.value.trim().replace(',', '.');
  const n = s === '' ? null : +s;
  if (n != null && (!Number.isFinite(n) || n < 0)) return (err.value = t('common.badAmount'));
  setTripTotal(tr, n == null ? null : Math.round(n * 100) / 100);
  editTotal.value = null;
  err.value = '';
}
async function pickReceipt(tr, ev) {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  busy.value = true;
  err.value = '';
  try { await uploadReceipt(tr, f); } catch (e) { err.value = e.message; } finally { busy.value = false; }
}
function dropReceipt(tr) { if (confirm(t('trips.confirmReceipt'))) deleteReceipt(tr); }
function removeTrip(tr) { if (confirm(t('trips.confirmTrip'))) emit('remove-trip', tr); }

// ------------------------------------------------------------ plantillas
const tplOpen = ref(null);
const slim = (list) => list.map(({ name, cat, qty, store }) => ({ name, cat, qty, store }));
function newTemplate(items, suggested) {
  const name = (prompt(t('tpl.namePrompt'), suggested || '') || '').trim();
  if (!name) return;
  const tpl = { id: newId(), name, items: slim(items) };
  saveTemplate(tpl);
  tab.value = 'templates';
  tplOpen.value = tpl.id;
}
function renameTemplate(tp) {
  const name = (prompt(t('tpl.renamePrompt'), tp.name) || '').trim();
  if (name && name !== tp.name) saveTemplate({ ...tp, name });
}
function dropFromTemplate(tp, i) {
  const items = tp.items.filter((x, j) => j !== i);
  saveTemplate({ ...tp, items });
}
function removeTemplate(tp) { if (confirm(t('tpl.confirmDelete', { name: tp.name }))) deleteTemplate(tp); }

// ------------------------------------------------------------ estadísticas
const st = computed(() => stats(S.trips));
const maxSpent = computed(() => Math.max(1, ...st.value.months.map((m) => m.spent)));
const sel = ref(5);
const monthLabel = (d, long) => {
  const s = d.toLocaleDateString(locale(), long ? { month: 'long', year: 'numeric' } : { month: 'short' }).replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
</script>

<template>
  <div class="sheet-bg" @click.self="emit('close')">
    <div class="sheet trips">
      <div class="trips-head">
        <h2>{{ t('trips.title') }}</h2>
        <button class="link" @click="emit('close')">{{ t('common.close') }}</button>
      </div>
      <nav class="seg">
        <button :class="{ on: tab === 'trips' }" @click="tab = 'trips'">{{ t('trips.tabTrips') }}</button>
        <button :class="{ on: tab === 'templates' }" @click="tab = 'templates'">{{ t('trips.tabTemplates') }}</button>
        <button :class="{ on: tab === 'stats' }" @click="tab = 'stats'">{{ t('trips.tabStats') }}</button>
      </nav>

      <!-- ====================================================== compras -->
      <div v-if="tab === 'trips'" class="trips-list">
        <p v-if="!S.trips.length" class="trips-empty">{{ t('trips.empty') }}</p>
        <section v-for="tr in S.trips" :key="tr.id" class="trip">
          <button class="trip-row" @click="toggle(tr.id)">
            <span class="trip-when">{{ when(tr.finished_at) }}<small>{{ storeLabel(tr.store) }} · {{ plural(tr.n, 'n.products') }}</small></span>
            <i v-if="tr.receipt" class="rcpt" :title="t('trips.withReceipt')"></i>
            <b class="trip-total" :class="{ none: tr.total == null }">{{ tr.total == null ? t('trips.noAmount') : eur(tr.total) }}</b>
            <span class="caret" :class="{ open: openId === tr.id }">▸</span>
          </button>
          <div v-if="openId === tr.id" class="trip-body">
            <ul>
              <li v-for="x in tr.items" :key="x.id">
                {{ x.name }}<b v-if="x.qty > 1" class="qty">×{{ x.qty }}</b>
              </li>
            </ul>

            <div class="trip-extra">
              <form v-if="editTotal !== null" class="total-edit" @submit.prevent="saveTotal(tr)">
                <input v-model="editTotal" type="text" inputmode="decimal" :placeholder="t('common.amountPh')" autocomplete="off" />
                <button class="primary small">{{ t('common.save') }}</button>
                <button type="button" class="link" @click="editTotal = null">{{ t('common.cancel') }}</button>
              </form>
              <button v-else class="link" @click="startTotal(tr)">{{ tr.total == null ? t('trips.addAmount') : t('trips.amount', { amount: eur(tr.total) }) }}</button>

              <div class="receipt-pick">
                <ReceiptThumb v-if="tr.receipt" :trip="tr" />
                <label class="chip-btn" :class="{ busy }">
                  <input type="file" accept="image/*" capture="environment" :disabled="busy" @change="pickReceipt(tr, $event)" />
                  {{ busy ? t('trips.uploading') : tr.receipt ? t('trips.changeReceipt') : t('trips.receiptPhoto') }}
                </label>
                <button v-if="tr.receipt" class="link danger" @click="dropReceipt(tr)">{{ t('common.remove') }}</button>
              </div>
              <p v-if="err" class="sheet-err">{{ err }}</p>
            </div>

            <div class="actions wrap">
              <button class="link danger" @click="removeTrip(tr)">{{ t('common.delete') }}</button>
              <button class="link" @click="newTemplate(tr.items)">{{ t('trips.saveTemplate') }}</button>
              <button class="primary" @click="emit('add', tr.items)">{{ t('trips.addAll') }}</button>
            </div>
          </div>
        </section>
      </div>

      <!-- ====================================================== plantillas -->
      <div v-else-if="tab === 'templates'" class="trips-list">
        <button class="primary tpl-new" :disabled="!props.pending.length" @click="newTemplate(props.pending)">
          {{ t('tpl.new') }}<small>{{ props.pending.length ? plural(props.pending.length, 'n.pending') : t('tpl.listEmpty') }}</small>
        </button>
        <p v-if="!S.templates.length" class="trips-empty">{{ t('tpl.empty') }}</p>
        <section v-for="tp in S.templates" :key="tp.id" class="trip">
          <button class="trip-row" @click="tplOpen = tplOpen === tp.id ? null : tp.id">
            <span class="trip-when">{{ tp.name }}<small>{{ plural(tp.items.length, 'n.products') }}</small></span>
            <span class="caret" :class="{ open: tplOpen === tp.id }">▸</span>
          </button>
          <div v-if="tplOpen === tp.id" class="trip-body">
            <ul>
              <li v-for="(x, i) in tp.items" :key="i" class="tpl-item">
                {{ x.name }}<b v-if="x.qty > 1" class="qty">×{{ x.qty }}</b>
                <button class="tpl-x" :aria-label="t('tpl.removeItem', { name: x.name })" @click="dropFromTemplate(tp, i)">×</button>
              </li>
            </ul>
            <div class="actions wrap">
              <button class="link danger" @click="removeTemplate(tp)">{{ t('common.delete') }}</button>
              <button class="link" @click="renameTemplate(tp)">{{ t('tpl.rename') }}</button>
              <button class="primary" :disabled="!tp.items.length" @click="emit('add', tp.items)">{{ t('tpl.add') }}</button>
            </div>
          </div>
        </section>
      </div>

      <!-- ====================================================== estadísticas -->
      <div v-else class="trips-list stats">
        <p v-if="!st.count" class="trips-empty">{{ t('stats.empty') }}</p>
        <template v-else>
          <div class="stat-grid">
            <div class="stat"><small>{{ t('stats.thisMonth') }}</small><b>{{ st.hasTotals ? eur(st.thisMonth.spent) : '—' }}</b><span>{{ plural(st.thisMonth.trips, 'n.trips') }}</span></div>
            <div class="stat"><small>{{ t('stats.lastMonth') }}</small><b>{{ st.hasTotals ? eur(st.lastMonth.spent) : '—' }}</b><span>{{ plural(st.lastMonth.trips, 'n.trips') }}</span></div>
            <div class="stat"><small>{{ t('stats.avgMonth') }}</small><b>{{ eur(st.avgMonth) }}</b></div>
            <div class="stat"><small>{{ t('stats.perTrip') }}</small><b>{{ eur(st.avgTrip) }}</b></div>
          </div>
          <p class="stat-note">
            <span v-if="st.every" v-html="t('stats.every', { days: plural(Math.round(st.every), 'n.days') })"></span>
            <template v-if="!st.hasTotals"> {{ t('stats.noTotals') }}</template>
          </p>

          <template v-if="st.hasTotals">
            <h3>{{ t('stats.chart') }}</h3>
            <div class="chart">
              <div class="chart-head">
                <b>{{ monthLabel(st.months[sel].date, true) }}</b>
                <span>{{ eur(st.months[sel].spent) }} · {{ plural(st.months[sel].trips, 'n.trips') }}</span>
              </div>
              <div class="bars" role="img" :aria-label="t('stats.chartAria', { max: eur(maxSpent) })">
                <span class="bars-max">{{ eur(maxSpent) }}</span>
                <button v-for="(m, i) in st.months" :key="m.key" class="col" :class="{ on: i === sel }" :aria-label="monthLabel(m.date, true) + ': ' + eur(m.spent)" @click="sel = i">
                  <span class="stack"><i v-if="m.spent" class="bar-fill" :style="{ height: (m.spent / maxSpent) * 100 + '%' }"></i></span>
                  <small>{{ monthLabel(m.date) }}</small>
                </button>
              </div>
            </div>
          </template>

          <h3>{{ t('stats.byStore') }}</h3>
          <div v-for="s in st.stores" :key="s.store || 'all'" class="rank-row">
            <span>{{ storeLabel(s.store) }}</span>
            <small>{{ plural(s.trips, 'n.trips') }}</small>
            <b>{{ st.hasTotals ? eur(s.spent) : '' }}</b>
          </div>

          <h3>{{ t('stats.top') }}</h3>
          <div v-for="(p, i) in st.top" :key="p.name" class="rank-row">
            <span>{{ i + 1 }}. {{ p.name }}</span>
            <small></small>
            <b>{{ plural(p.times, 'n.times') }}</b>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
