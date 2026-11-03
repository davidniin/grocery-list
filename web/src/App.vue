<script setup>
// La compra en el móvil: lista por pasillos. Tocar o deslizar a la derecha tacha, deslizar a la izquierda borra,
// mantener pulsado (o ⋯) edita. Abajo se añade: "leche x2", varios separados por comas, o los habituales.
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { S, DEMO, resetDemo, addItem, update, remove, newId, setToken, finishTrip, undoTrip, deleteTrip, loadTrips, uploadReceipt } from './sync.js';
import { dueSoon } from './habits.js';
import { buzz } from './buzz.js';
import SwipeRow from './SwipeRow.vue';
import EditSheet from './EditSheet.vue';
import TripsSheet from './TripsSheet.vue';
import FinishSheet from './FinishSheet.vue';

// Hasta que llega /v1/meta la primera vez (sin red y sin nada guardado)
const FALLBACK = { stores: [{ id: 'super', name: 'Mercadona' }], cats: [], catOrder: {}, usuals: [] };
const meta = computed(() => S.meta || FALLBACK);

// Icono y color de cada pasillo
const CAT_STYLE = {
  'Fruta y verdura': ['🥦', '#4caf50'],
  'Panadería': ['🥖', '#d39b3a'],
  'Carne y pescado': ['🥩', '#e0675a'],
  'Lácteos y huevos': ['🧀', '#e3bd3b'],
  'Despensa': ['🥫', '#c97a3e'],
  'Congelados': ['🧊', '#4ea3e0'],
  'Picoteo': ['🍿', '#b07ccf'],
  'Hogar': ['🧻', '#7f93ab'],
};
const catIcon = (c) => (CAT_STYLE[c] || ['🛒'])[0];
const catColor = (c) => (CAT_STYLE[c] || [0, '#9d968b'])[1];

function pref(k, def) { try { return localStorage.getItem('compra.' + k) || def; } catch (e) { return def; } }
const store = ref(pref('store', 'all'));
watch(store, (v) => { try { localStorage.setItem('compra.store', v); } catch (e) { /* nada */ } });

const query = ref('');
const focused = ref(false);
const editing = ref(null);
const showDone = ref(false);
const showTrips = ref(false);
const showFinish = ref(false);
const tokenText = ref('');
const toast = ref(null);
const flashId = ref(null);
const checking = reactive({});
const compact = ref(false);
let toastTimer = null, blurTimer = null;

// ------------------------------------------------------------ lista
const inStore = (g) => store.value === 'all' || g.store === store.value;
const open = computed(() => S.items.filter((g) => !g.done && inStore(g)));
const done = computed(() => S.items.filter((g) => g.done && inStore(g)));
const total = computed(() => open.value.length + done.value.length);
const pct = computed(() => total.value ? Math.round(done.value.length / total.value * 100) : 0);
const groups = computed(() => {
  const order = (meta.value.catOrder[store.value] || meta.value.cats).concat(['Otros']);
  const extra = [...new Set(open.value.map((g) => g.cat))].filter((c) => !order.includes(c));
  return order.concat(extra)
    .map((cat) => ({ cat, items: open.value.filter((g) => g.cat === cat) }))
    .filter((x) => x.items.length);
});
const tabs = computed(() => {
  const all = S.items.filter((g) => !g.done);
  return [{ id: 'all', name: 'Todas', n: all.length }]
    .concat(meta.value.stores.map((s) => ({ id: s.id, name: s.name, n: all.filter((g) => g.store === s.id).length })));
});
const storeName = (id) => (meta.value.stores.find((s) => s.id === id) || {}).name || '';
const sub = (g) => [store.value === 'all' ? storeName(g.store) : '', g.note].filter(Boolean).join(' · ');

const status = computed(() => {
  if (!S.online) return { cls: 'off', text: S.queue.length ? 'Sin conexión · ' + S.queue.length + ' sin enviar' : 'Sin conexión' };
  if (S.queue.length) return { cls: 'busy', text: 'Guardando…' };
  if (S.version < 0) return { cls: 'busy', text: 'Conectando…' };
  return { cls: 'ok', text: 'Al día' };
});

// ------------------------------------------------------------ añadir
const lower = (s) => s.trim().toLowerCase();
const find = (name, isDone) => S.items.find((g) => !!g.done === isDone && lower(g.name) === lower(name));
const product = (name) => S.products.find((p) => lower(p.name) === lower(name));

// "pan, huevos x12, Café ×2" → [{ name: 'pan', qty: 1 }, { name: 'huevos', qty: 12 }, { name: 'Café', qty: 2 }]
function parse(text) {
  return text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = /^(.*\S)\s+[x×]\s*(\d{1,3})$/i.exec(s);
    return m ? { name: m[1], qty: Math.max(1, +m[2]) } : { name: s, qty: 1 };
  });
}

// Categoría de un producto nuevo: igual que el dashboard, por parecido con los conocidos
function categorize(name) {
  const n = lower(name);
  const hit = S.products.find((p) => { const a = lower(p.name); return a.includes(n) || n.includes(a); }) ||
    S.products.find((p) => n.split(/\s+/).some((w) => w.length > 3 && lower(p.name).includes(w)));
  return hit ? hit.cat : 'Otros';
}

// Sugerencias para lo último que se está escribiendo (tras la última coma)
const typing = computed(() => {
  const parts = query.value.split(/[,;]/);
  return parse(parts[parts.length - 1])[0] || null;
});
const suggestions = computed(() => {
  if (!typing.value) return [];
  const q = lower(typing.value.name);
  const starts = S.products.filter((p) => lower(p.name).startsWith(q));
  const has = S.products.filter((p) => !lower(p.name).startsWith(q) && lower(p.name).includes(q));
  return starts.concat(has).slice(0, 6).map((p) => ({ name: p.name, cat: p.cat, on: find(p.name, false) }));
});
// Habituales: lo que más compras; mientras aprende, se completa con los de partida
const usuals = computed(() => {
  const learned = S.products.filter((p) => p.uses > 0).map((p) => p.name);
  const base = (meta.value.usuals || []).filter((n) => !learned.some((l) => lower(l) === lower(n)));
  return learned.concat(base).slice(0, 12).map((name) => ({ name, on: find(name, false) }));
});
const panel = computed(() => (focused.value ? (query.value.trim() ? (suggestions.value.length ? 'sugg' : '') : 'usuals') : ''));

function addOne({ name, qty }) {
  const on = find(name, false), old = find(name, true);
  if (on) {
    update(on, { qty: on.qty + qty });
    return { g: on, msg: on.name + ' ×' + on.qty + ' (ya estaba)' };
  }
  if (old) {
    update(old, { done: false, qty });
    return { g: old, msg: old.name + (qty > 1 ? ' ×' + qty : '') + ' vuelve a la lista' };
  }
  const p = product(name);
  const dest = store.value !== 'all' ? store.value : (p && p.store) || meta.value.stores[0].id;
  const g = { id: newId(), name: p ? p.name : name.charAt(0).toUpperCase() + name.slice(1), cat: p ? p.cat : categorize(name), qty, store: dest, done: false, note: '' };
  addItem(g);
  return { g, msg: null };
}
function add(text) {
  const list = parse(text);
  if (!list.length) return;
  const res = list.map(addOne);
  query.value = '';
  buzz(8);
  if (res.length > 1) say('Añadidos: ' + res.map((r) => r.g.name + (r.g.qty > 1 ? ' ×' + r.g.qty : '')).join(', '));
  else if (res[0].msg) say(res[0].msg);
  flash(res[res.length - 1].g);
}
// Elegir una sugerencia: sustituye lo que se estaba escribiendo y conserva la cantidad ("lec x2" → "Leche x2")
function pick(name) {
  const parts = query.value.split(/[,;]/);
  const qty = typing.value ? typing.value.qty : 1;
  parts[parts.length - 1] = name + (qty > 1 ? ' x' + qty : '');
  add(parts.join(','));
}
function flash(g) {
  flashId.value = g.id;
  nextTick(() => {
    const el = document.querySelector('[data-id="' + g.id + '"]');
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  setTimeout(() => { if (flashId.value === g.id) flashId.value = null; }, 1400);
}
function onFocus() { clearTimeout(blurTimer); focused.value = true; }
function onBlur() { blurTimer = setTimeout(() => { focused.value = false; }, 120); }

// ------------------------------------------------------------ tachar, editar, borrar
function check(g, swiped) {
  if (checking[g.id]) return;
  const undo = () => update(g, { done: false });
  if (swiped) { update(g, { done: true }); say('Al carro: ' + g.name, undo); return; }
  // Primero se ve el check; después la fila se va al carro
  checking[g.id] = true;
  buzz(10);
  setTimeout(() => {
    delete checking[g.id];
    update(g, { done: true });
    say('Al carro: ' + g.name, undo);
  }, 320);
}
function uncheck(g) { buzz(8); update(g, { done: false }); flash(g); }
function edit(g) { editing.value = g; }
function save(fields) { update(editing.value, fields); editing.value = null; }
function drop(g) {
  if (editing.value && editing.value.id === g.id) editing.value = null;
  buzz(20);
  remove(g);
  say('Borrado: ' + g.name, () => addItem(Object.assign({}, g)));
}
// ------------------------------------------------------------ compra finalizada e historial
// Primero la ficha (importe y foto del ticket, opcionales); al confirmar se guarda la compra
function finish({ total, file }) {
  showFinish.value = false;
  const t = finishTrip(store.value === 'all' ? null : store.value, total);
  if (!t) return;
  buzz([20, 60, 20]);
  showDone.value = false;
  const left = open.value.length;
  say('🎉 Compra guardada · ' + t.n + (t.n === 1 ? ' producto' : ' productos') + (left ? ' · ' + (left === 1 ? '1 pendiente sigue' : left + ' pendientes siguen') + ' en la lista' : ''), () => undoTrip(t), 6000);
  if (file) uploadReceipt(t, file).catch((e) => say('🧾 ' + e.message));
}
function openTrips() { loadTrips(); showTrips.value = true; }
// Añadir de golpe (una compra pasada o una plantilla): solo lo que no esté ya pendiente en la lista
function addMany(items) {
  let n = 0;
  for (const x of items) {
    if (find(x.name, false)) continue;
    addItem({ id: newId(), name: x.name, cat: x.cat, qty: x.qty, store: x.store, done: false, note: x.note || '' });
    n++;
  }
  showTrips.value = false;
  say(n ? 'Añadidos ' + n + (n === 1 ? ' producto' : ' productos') + ' a la lista' : 'Ya estaba todo en la lista');
}

// "Se te suele acabar": lo que compras con regularidad y ya toca (sale del historial)
const due = computed(() => dueSoon(S.trips, S.items));

function say(text, undo, ms = 3500) {
  clearTimeout(toastTimer);
  toast.value = { text, undo, key: Date.now() };
  toastTimer = setTimeout(() => { toast.value = null; }, ms);
}
function undo() { const t = toast.value; toast.value = null; if (t && t.undo) t.undo(); }

// ------------------------------------------------------------ cabecera compacta y pantalla encendida
onMounted(() => {
  const onScroll = () => { compact.value = window.scrollY > 24; };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  // En el súper la pantalla no se apaga mientras la app está abierta (necesita HTTPS: Tailscale)
  const awake = () => {
    if (!document.hidden && 'wakeLock' in navigator) navigator.wakeLock.request('screen').catch(() => {});
  };
  awake();
  document.addEventListener('visibilitychange', awake);
});
</script>

<template>
  <div class="app">
    <div v-if="DEMO" class="demo-bar">
      <span>🧪 Demo · datos inventados, no se guarda nada</span>
      <button class="link" @click="resetDemo">Reiniciar</button>
    </div>
    <header class="top" :class="{ compact }">
      <div class="top-row">
        <h1>La compra</h1>
        <span class="status" :class="status.cls">{{ status.text }}</span>
      </div>
      <nav class="tabs">
        <button v-for="t in tabs" :key="t.id" :class="{ on: store === t.id }" @click="store = t.id">
          {{ t.name }} <span>{{ t.n }}</span>
        </button>
      </nav>
      <div v-if="total" class="progress">
        <div class="bar"><i :style="{ width: pct + '%' }" /></div>
        <span><b>{{ done.length }}</b> de {{ total }} en el carro</span>
      </div>
    </header>

    <Transition name="fade" mode="out-in">
      <main :key="store" class="list">
        <div v-if="!open.length" class="empty">
          <div class="empty-icon">{{ done.length ? '🎉' : '🧺' }}</div>
          <p>{{ done.length ? '¡Todo en el carro!' : 'Nada por comprar' + (store !== 'all' ? ' en ' + storeName(store) : '') }}</p>
          <template v-if="!done.length && usuals.length">
            <p class="hint">Empieza por tus habituales</p>
            <div class="usuals">
              <button v-for="u in usuals" :key="u.name" type="button" :class="{ on: u.on }" @click="add(u.name)">
                {{ u.name }}<span v-if="u.on"> ✓{{ u.on.qty > 1 ? ' ×' + u.on.qty : '' }}</span>
              </button>
            </div>
          </template>
        </div>

        <section v-if="due.length" class="habits">
          <h2><span class="emoji">🔁</span>Se te suele acabar</h2>
          <div class="usuals">
            <button v-for="d in due" :key="d.name" type="button" @click="add(d.name)">
              {{ d.name }}<small>cada {{ d.every }} d</small>
            </button>
          </div>
        </section>

        <TransitionGroup name="sec" tag="div" class="secs">
          <section v-for="grp in groups" :key="grp.cat" :style="{ '--c': catColor(grp.cat) }">
            <h2><span class="emoji">{{ catIcon(grp.cat) }}</span>{{ grp.cat }}<span class="n">{{ grp.items.length }}</span></h2>
            <TransitionGroup name="row" tag="div" class="rows">
              <SwipeRow
                v-for="g in grp.items" :key="g.id" :data-id="g.id"
                :class="{ checking: checking[g.id], 'is-new': flashId === g.id }"
                right="Al carro" left="Borrar"
                @tap="check(g)" @right="check(g, true)" @left="drop(g)" @hold="edit(g)"
              >
                <span class="box"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
                <span class="name">
                  {{ g.name }}<b v-if="g.qty > 1" class="qty">×{{ g.qty }}</b>
                  <small v-if="sub(g)">{{ sub(g) }}</small>
                </span>
                <button class="more" aria-label="Editar" @pointerdown.stop @click.stop="edit(g)">⋯</button>
              </SwipeRow>
            </TransitionGroup>
          </section>
        </TransitionGroup>

        <section v-if="done.length" class="done">
          <button class="primary finish" @click="showFinish = true">
            ✓ Compra finalizada<small>{{ done.length }} en el carro{{ open.length ? ' · ' + (open.length === 1 ? '1 pendiente se queda' : open.length + ' pendientes se quedan') : '' }}</small>
          </button>
          <div class="done-head">
            <button class="link" @click="showDone = !showDone">
              <span class="caret" :class="{ open: showDone }">▸</span> En el carro ({{ done.length }})
            </button>
          </div>
          <TransitionGroup v-if="showDone" name="row" tag="div" class="rows">
            <SwipeRow v-for="g in done" :key="g.id" :data-id="g.id" class="is-done" left="Borrar" @tap="uncheck(g)" @left="drop(g)" @hold="edit(g)">
              <span class="box"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
              <span class="name">{{ g.name }}<b v-if="g.qty > 1" class="qty">×{{ g.qty }}</b></span>
            </SwipeRow>
          </TransitionGroup>
        </section>

        <p v-if="total" class="tips">Desliza → al carro · ← borrar · mantén pulsado para editar</p>
        <p class="tips"><button class="link" @click="openTrips">🧾 Historial, plantillas y estadísticas</button></p>
      </main>
    </Transition>

    <form class="add" @submit.prevent="add(query)">
      <Transition name="pop">
        <div v-if="panel === 'sugg'" class="panel">
          <button v-for="s in suggestions" :key="s.name" type="button" class="sugg" @pointerdown.prevent @click="pick(s.name)">
            <span class="emoji">{{ catIcon(s.cat) }}</span>
            <b>{{ s.name }}</b><span class="meta">{{ s.on ? 'En la lista · ×' + s.on.qty : s.cat }}</span><i>+</i>
          </button>
        </div>
        <div v-else-if="panel === 'usuals'" class="panel">
          <div class="panel-title">Habituales</div>
          <div class="usuals">
            <button v-for="u in usuals" :key="u.name" type="button" :class="{ on: u.on }" @pointerdown.prevent @click="add(u.name)">
              {{ u.name }}<span v-if="u.on"> ✓{{ u.on.qty > 1 ? ' ×' + u.on.qty : '' }}</span>
            </button>
          </div>
          <template v-if="S.templates.length">
            <div class="panel-title">Plantillas</div>
            <div class="usuals">
              <button v-for="t in S.templates" :key="t.id" type="button" @pointerdown.prevent @click="addMany(t.items)">📋 {{ t.name }}</button>
            </div>
          </template>
          <div class="panel-hint">Escribe varios con comas · «leche x2» para cantidad</div>
        </div>
      </Transition>
      <input
        v-model="query" type="text" placeholder="Añadir… (leche x2, pan)" enterkeyhint="done"
        autocomplete="off" autocapitalize="sentences" @focus="onFocus" @blur="onBlur"
      />
      <button type="submit" class="primary" :disabled="!query.trim()" @pointerdown.prevent>Añadir</button>
    </form>

    <Transition name="toast">
      <div v-if="toast" :key="toast.key" class="toast">
        <span>{{ toast.text }}</span>
        <button v-if="toast.undo" class="link" @click="undo">Deshacer</button>
      </div>
    </Transition>

    <Transition name="sheet" :duration="320">
      <EditSheet v-if="editing" :key="editing.id" :item="editing" :meta="meta" @close="editing = null" @save="save" @remove="drop(editing)" />
    </Transition>

    <Transition name="sheet" :duration="320">
      <TripsSheet v-if="showTrips" :store-name="storeName" :cat-icon="catIcon" :pending="open" @close="showTrips = false" @add="addMany" @remove-trip="deleteTrip" />
    </Transition>
    <Transition name="sheet" :duration="320">
      <FinishSheet
        v-if="showFinish" :n="done.length" :left="open.length" :where="store === 'all' ? '' : storeName(store)"
        @close="showFinish = false" @finish="finish"
      />
    </Transition>

    <div v-if="!S.auth" class="gate">
      <form @submit.prevent="setToken(tokenText)">
        <h2>Clave de acceso</h2>
        <p>Escribe el <code>GROCERY_TOKEN</code> del servidor. Se guarda en este dispositivo.</p>
        <input v-model="tokenText" type="password" autocomplete="current-password" />
        <button class="primary" :disabled="!tokenText.trim()">Entrar</button>
      </form>
    </div>
  </div>
</template>
