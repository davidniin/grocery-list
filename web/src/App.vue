<script setup>
// La compra en el móvil: lista por pasillos. Tocar o deslizar a la derecha tacha, deslizar a la izquierda borra,
// mantener pulsado (o ⋯) edita. Abajo se añade: "leche x2", varios separados por comas, o los habituales.
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { S, DEMO, resetDemo, addItem, update, remove, newId, setToken, finishTrip, undoTrip, deleteTrip, loadTrips, uploadReceipt } from './sync.js';
import { t, lang, setLang, catLabel } from './i18n/index.js';
import { dueSoon } from './habits.js';
import { buzz } from './buzz.js';
import SwipeRow from './SwipeRow.vue';
import EditSheet from './EditSheet.vue';
import TripsSheet from './TripsSheet.vue';
import FinishSheet from './FinishSheet.vue';
import StoresSheet from './StoresSheet.vue';

// Hasta que llega /v1/meta la primera vez (sin red y sin nada guardado)
const FALLBACK = { stores: [{ id: 'super', name: 'Mercadona' }], cats: [], catOrder: {}, usuals: [] };
const meta = computed(() => S.meta || FALLBACK);

// Color de cada pasillo (los pasillos se guardan en español; catLabel() da el nombre en el idioma de la app)
const CAT_COLOR = {
  'Fruta y verdura': '#4caf50',
  'Panadería': '#d39b3a',
  'Carne y pescado': '#e0675a',
  'Lácteos y huevos': '#e3bd3b',
  'Despensa': '#c97a3e',
  'Congelados': '#4ea3e0',
  'Picoteo': '#b07ccf',
  'Hogar': '#7f93ab',
};
const catColor = (c) => CAT_COLOR[c] || '#9d968b';

function pref(k, def) { try { return localStorage.getItem('compra.' + k) || def; } catch (e) { return def; } }
const store = ref(pref('store', 'all'));
watch(store, (v) => { try { localStorage.setItem('compra.store', v); } catch (e) { /* nada */ } });
// Si se borra la tienda de la pestaña abierta (aquí o en otro móvil), se vuelve a "Todas"
watch(() => meta.value.stores, (list) => { if (store.value !== 'all' && !list.some((s) => s.id === store.value)) store.value = 'all'; });

const query = ref('');
const focused = ref(false);
const input = ref(null);
const editing = ref(null);
const showDone = ref(false);
const showTrips = ref(false);
const showFinish = ref(false);
const showStores = ref(false);
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
  return [{ id: 'all', name: t('store.all'), n: all.length }]
    .concat(meta.value.stores.map((s) => ({ id: s.id, name: s.name, n: all.filter((g) => g.store === s.id).length })));
});
const storeName = (id) => (meta.value.stores.find((s) => s.id === id) || {}).name || '';
const sub = (g) => [store.value === 'all' ? storeName(g.store) : '', g.note].filter(Boolean).join(' · ');

const status = computed(() => {
  if (!S.online) return { cls: 'off', text: S.queue.length ? t('status.offlinePending', { n: S.queue.length }) : t('status.offline') };
  if (S.queue.length) return { cls: 'busy', text: t('status.saving') };
  if (S.version < 0) return { cls: 'busy', text: t('status.connecting') };
  return { cls: 'ok', text: t('status.ok') };
});

// ------------------------------------------------------------ añadir
const lower = (s) => s.trim().toLowerCase();
const find = (name, isDone) => S.items.find((g) => !!g.done === isDone && lower(g.name) === lower(name));
const product = (name) => S.products.find((p) => lower(p.name) === lower(name));
const validStore = (id) => meta.value.stores.some((s) => s.id === id);

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
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

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

// Producto nuevo: lo que se escribe no es ninguno conocido ni está ya en la lista. Antes de añadirlo se puede elegir
// pasillo (viene uno propuesto) y tienda; lo elegido se aprende para la próxima vez.
const fresh = computed(() => {
  const x = typing.value;
  if (!x || x.name.length < 2 || product(x.name) || find(x.name, false) || find(x.name, true)) return null;
  return { name: capitalize(x.name), qty: x.qty };
});
const pickCat = ref(null);
const pickStore = ref(null);
const freshOpen = ref(false);
watch(() => fresh.value && lower(fresh.value.name), () => { pickCat.value = null; pickStore.value = null; freshOpen.value = false; });
// Si hay sugerencias parecidas, primero ellas y el producto nuevo en una fila que se despliega al tocarla
const freshCard = computed(() => fresh.value && (!suggestions.value.length || freshOpen.value));
// El pasillo y la tienda elegidos, siempre a la vista (las filas de opciones se desplazan de lado)
watch(() => [freshCard.value && fresh.value.name, freshCat.value, freshStore.value], () => nextTick(() => {
  for (const el of document.querySelectorAll('.fresh .chip.on')) {
    const row = el.parentElement;
    row.scrollLeft = el.offsetLeft - row.clientWidth / 2 + el.clientWidth / 2;
  }
}));
const freshCat = computed(() => pickCat.value || (fresh.value ? categorize(fresh.value.name) : 'Otros'));
const freshStore = computed(() => pickStore.value || (store.value !== 'all' ? store.value : meta.value.stores[0].id));
const aisles = computed(() => meta.value.cats.concat(['Otros']));

// Habituales: lo que más compras; mientras aprende, se completa con los de partida
const usuals = computed(() => {
  const learned = S.products.filter((p) => p.uses > 0).map((p) => p.name);
  const base = (meta.value.usuals || []).filter((n) => !learned.some((l) => lower(l) === lower(n)));
  return learned.concat(base).slice(0, 12).map((name) => ({ name, on: find(name, false) }));
});
const panel = computed(() => {
  if (!focused.value) return '';
  if (!query.value.trim()) return 'usuals';
  return suggestions.value.length || fresh.value ? 'sugg' : '';
});

function addOne({ name, qty }, choice) {
  const on = find(name, false), old = find(name, true);
  if (on) {
    update(on, { qty: on.qty + qty });
    return { g: on, msg: t('toast.already', { name: on.name, n: on.qty }) };
  }
  if (old) {
    update(old, { done: false, qty });
    return { g: old, msg: t('toast.back', { name: old.name + (qty > 1 ? ' ×' + qty : '') }) };
  }
  const p = product(name);
  const fromProduct = p && validStore(p.store) ? p.store : null;
  const dest = (choice && choice.store) || (store.value !== 'all' ? store.value : fromProduct || meta.value.stores[0].id);
  const g = {
    id: newId(), name: p ? p.name : capitalize(name), cat: (choice && choice.cat) || (p ? p.cat : categorize(name)),
    qty, store: dest, done: false, note: '',
  };
  addItem(g);
  return { g, msg: null };
}
function add(text) {
  const list = parse(text);
  if (!list.length) { closePanel(); return; } // "Intro" con el cuadro vacío: cerrar
  // Lo elegido en la ficha de "producto nuevo" vale para el último producto escrito, si es ese
  const choice = fresh.value ? { cat: freshCat.value, store: freshStore.value } : null;
  const res = list.map((x, i) => addOne(x, i === list.length - 1 && choice && lower(x.name) === lower(fresh.value.name) ? choice : null));
  query.value = '';
  buzz(8);
  if (res.length > 1) say(t('toast.added', { list: res.map((r) => r.g.name + (r.g.qty > 1 ? ' ×' + r.g.qty : '')).join(', ') }));
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
// Cerrar el panel (y el teclado): botón "Listo", tocar fuera, Intro sin texto, Esc o bajar el teclado
function closePanel() {
  clearTimeout(blurTimer);
  focused.value = false;
  if (input.value) input.value.blur();
}

// ------------------------------------------------------------ tachar, editar, borrar
function check(g, swiped) {
  if (checking[g.id]) return;
  const undo = () => update(g, { done: false });
  if (swiped) { update(g, { done: true }); say(t('toast.toCart', { name: g.name }), undo); return; }
  // Primero se ve el check; después la fila se va al carro
  checking[g.id] = true;
  buzz(10);
  setTimeout(() => {
    delete checking[g.id];
    update(g, { done: true });
    say(t('toast.toCart', { name: g.name }), undo);
  }, 320);
}
function uncheck(g) { buzz(8); update(g, { done: false }); flash(g); }
function edit(g) { closePanel(); editing.value = g; }
function save(fields) { update(editing.value, fields); editing.value = null; }
function drop(g) {
  if (editing.value && editing.value.id === g.id) editing.value = null;
  buzz(20);
  remove(g);
  say(t('toast.deleted', { name: g.name }), () => addItem(Object.assign({}, g)));
}
// ------------------------------------------------------------ compra finalizada e historial
// Primero la ficha (importe y foto del ticket, opcionales); al confirmar se guarda la compra
function finish({ total, file }) {
  showFinish.value = false;
  const tr = finishTrip(store.value === 'all' ? null : store.value, total);
  if (!tr) return;
  buzz([20, 60, 20]);
  showDone.value = false;
  const left = open.value.length;
  say(t('toast.saved', { n: tr.n }) + (left ? t('toast.savedLeft', { n: left }) : ''), () => undoTrip(tr), 6000);
  if (file) uploadReceipt(tr, file).catch((e) => say(e.message));
}
function openTrips() { loadTrips(); showTrips.value = true; }
// Añadir de golpe (una compra pasada o una plantilla): solo lo que no esté ya pendiente en la lista
function addMany(items) {
  let n = 0;
  for (const x of items) {
    if (find(x.name, false)) continue;
    addItem({ id: newId(), name: x.name, cat: x.cat, qty: x.qty, store: validStore(x.store) ? x.store : null, done: false, note: x.note || '' });
    n++;
  }
  showTrips.value = false;
  say(n ? t('toast.addedMany', { n }) : t('toast.allThere'));
}

// "Se te suele acabar": lo que compras con regularidad y ya toca (sale del historial)
const due = computed(() => dueSoon(S.trips, S.items));

function say(text, undo, ms = 3500) {
  clearTimeout(toastTimer);
  toast.value = { text, undo, key: Date.now() };
  toastTimer = setTimeout(() => { toast.value = null; }, ms);
}
function undo() { const tt = toast.value; toast.value = null; if (tt && tt.undo) tt.undo(); }

// ------------------------------------------------------------ idioma
watch(lang, () => { document.title = t('app.title'); }, { immediate: true });
function toggleLang() {
  const l = lang.value === 'es' ? 'en' : 'es';
  setLang(l);
  // La demo vuelve a crear sus datos inventados en el otro idioma
  if (DEMO) { const u = new URL(location.href); u.searchParams.set('lang', l); location.replace(u); }
}

// ------------------------------------------------------------ cabecera compacta, pantalla encendida y teclado
onMounted(() => {
  const onScroll = () => { compact.value = window.scrollY > 24; };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  // En el súper la pantalla no se apaga mientras la app está abierta (necesita HTTPS)
  const awake = () => {
    if (!document.hidden && 'wakeLock' in navigator) navigator.wakeLock.request('screen').catch(() => {});
  };
  awake();
  document.addEventListener('visibilitychange', awake);
  // Android: bajar el teclado (botón atrás) no quita el foco del cuadro y el panel se quedaba abierto encima de la
  // lista. Si el teclado se cierra mientras el panel está abierto, se cierra también el panel.
  const vv = window.visualViewport;
  if (vv) {
    let keyboard = false;
    vv.addEventListener('resize', () => {
      const up = vv.height < window.innerHeight - 120;
      if (keyboard && !up && focused.value) closePanel();
      keyboard = up;
    });
  }
});
</script>

<template>
  <div class="app">
    <div v-if="DEMO" class="demo-bar">
      <span>{{ t('demo.bar') }}</span>
      <button class="link" @click="resetDemo">{{ t('demo.reset') }}</button>
    </div>
    <header class="top" :class="{ compact }">
      <div class="top-row">
        <h1>{{ t('app.title') }}</h1>
        <span class="status" :class="status.cls">{{ status.text }}</span>
      </div>
      <nav class="tabs">
        <button v-for="tb in tabs" :key="tb.id" :class="{ on: store === tb.id }" @click="store = tb.id">
          {{ tb.name }} <span>{{ tb.n }}</span>
        </button>
        <button class="tab-add" :aria-label="t('stores.title')" @click="showStores = true">＋</button>
      </nav>
      <div v-if="total" class="progress">
        <div class="bar"><i :style="{ width: pct + '%' }" /></div>
        <span v-html="t('progress', { done: done.length, total })"></span>
      </div>
    </header>

    <Transition name="fade" mode="out-in">
      <main :key="store" class="list">
        <div v-if="!open.length" class="empty">
          <p>{{ done.length ? t('empty.allDone') : store !== 'all' ? t('empty.nothingIn', { store: storeName(store) }) : t('empty.nothing') }}</p>
          <template v-if="!done.length && usuals.length">
            <p class="hint">{{ t('empty.startUsuals') }}</p>
            <div class="usuals">
              <button v-for="u in usuals" :key="u.name" type="button" :class="{ on: u.on }" @click="add(u.name)">
                {{ u.name }}<span v-if="u.on"> ✓{{ u.on.qty > 1 ? ' ×' + u.on.qty : '' }}</span>
              </button>
            </div>
          </template>
        </div>

        <section v-if="due.length" class="habits">
          <h2>{{ t('habits.title') }}</h2>
          <div class="usuals">
            <button v-for="d in due" :key="d.name" type="button" @click="add(d.name)">
              {{ d.name }}<small>{{ t('habits.every', { n: d.every }) }}</small>
            </button>
          </div>
        </section>

        <TransitionGroup name="sec" tag="div" class="secs">
          <section v-for="grp in groups" :key="grp.cat" :style="{ '--c': catColor(grp.cat) }">
            <h2><i class="swatch"></i>{{ catLabel(grp.cat) }}<span class="n">{{ grp.items.length }}</span></h2>
            <TransitionGroup name="row" tag="div" class="rows">
              <SwipeRow
                v-for="g in grp.items" :key="g.id" :data-id="g.id"
                :class="{ checking: checking[g.id], 'is-new': flashId === g.id }"
                :right="t('swipe.cart')" :left="t('swipe.delete')"
                @tap="check(g)" @right="check(g, true)" @left="drop(g)" @hold="edit(g)"
              >
                <span class="box"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
                <span class="name">
                  {{ g.name }}<b v-if="g.qty > 1" class="qty">×{{ g.qty }}</b>
                  <small v-if="sub(g)">{{ sub(g) }}</small>
                </span>
                <button class="more" :aria-label="t('item.edit')" @pointerdown.stop @click.stop="edit(g)">⋯</button>
              </SwipeRow>
            </TransitionGroup>
          </section>
        </TransitionGroup>

        <section v-if="done.length" class="done">
          <button class="primary finish" @click="showFinish = true">
            {{ t('finish.button') }}<small>{{ t('finish.inCart', { n: done.length }) }}{{ open.length ? ' · ' + t('finish.leftStay', { n: open.length }) : '' }}</small>
          </button>
          <div class="done-head">
            <button class="link" @click="showDone = !showDone">
              <span class="caret" :class="{ open: showDone }">▸</span> {{ t('cart.title', { n: done.length }) }}
            </button>
          </div>
          <TransitionGroup v-if="showDone" name="row" tag="div" class="rows">
            <SwipeRow v-for="g in done" :key="g.id" :data-id="g.id" class="is-done" :left="t('swipe.delete')" @tap="uncheck(g)" @left="drop(g)" @hold="edit(g)">
              <span class="box"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
              <span class="name">{{ g.name }}<b v-if="g.qty > 1" class="qty">×{{ g.qty }}</b></span>
            </SwipeRow>
          </TransitionGroup>
        </section>

        <p v-if="total" class="tips">{{ t('tips.gestures') }}</p>
        <p class="tips">
          <button class="link" @click="openTrips">{{ t('tips.history') }}</button>
          <span class="dot">·</span>
          <button class="link" @click="showStores = true">{{ t('tips.stores') }}</button>
          <span class="dot">·</span>
          <button class="link" :lang="lang === 'es' ? 'en' : 'es'" @click="toggleLang">{{ t('tips.lang') }}</button>
        </p>
      </main>
    </Transition>

    <!-- Tocar fuera del panel lo cierra -->
    <Transition name="fade">
      <div v-if="panel" class="panel-bg" @pointerdown.prevent="closePanel" />
    </Transition>

    <form class="add" @submit.prevent="add(query)">
      <Transition name="pop">
        <div v-if="panel === 'sugg'" class="panel">
          <div v-if="freshCard" class="fresh">
            <div class="panel-head">
              <span class="panel-title">{{ t('new.title') }}</span>
              <button type="button" class="link" @pointerdown.prevent @click="closePanel">{{ t('add.done') }}</button>
            </div>
            <div class="fresh-label">{{ t('new.aisle') }}</div>
            <div class="chips-row">
              <button
                v-for="c in aisles" :key="c" type="button" class="chip" :class="{ on: freshCat === c }"
                @pointerdown.prevent @click="pickCat = c"
              >{{ catLabel(c) }}</button>
            </div>
            <template v-if="store === 'all' && meta.stores.length > 1">
              <div class="fresh-label">{{ t('new.store') }}</div>
              <div class="chips-row">
                <button
                  v-for="s in meta.stores" :key="s.id" type="button" class="chip" :class="{ on: freshStore === s.id }"
                  @pointerdown.prevent @click="pickStore = s.id"
                >{{ s.name }}</button>
              </div>
            </template>
            <button type="submit" class="primary fresh-add" @pointerdown.prevent>
              {{ t('new.add', { name: fresh.name + (fresh.qty > 1 ? ' ×' + fresh.qty : '') }) }}
            </button>
          </div>
          <div v-else class="panel-head">
            <span class="panel-title">{{ t('add.button') }}</span>
            <button type="button" class="link" @pointerdown.prevent @click="closePanel">{{ t('add.done') }}</button>
          </div>
          <button v-for="s in suggestions" :key="s.name" type="button" class="sugg" @pointerdown.prevent @click="pick(s.name)">
            <i class="swatch" :style="{ '--c': catColor(s.cat) }"></i>
            <b>{{ s.name }}</b><span class="meta">{{ s.on ? t('add.inList', { n: s.on.qty }) : catLabel(s.cat) }}</span><i>+</i>
          </button>
          <button v-if="fresh && !freshCard" type="button" class="sugg sugg-new" @pointerdown.prevent @click="freshOpen = true">
            <span class="plus">+</span><b>{{ t('new.row', { name: fresh.name }) }}</b><span class="meta"></span><i>›</i>
          </button>
        </div>
        <div v-else-if="panel === 'usuals'" class="panel">
          <div class="panel-head">
            <span class="panel-title">{{ t('add.usuals') }}</span>
            <button type="button" class="link" @pointerdown.prevent @click="closePanel">{{ t('add.done') }}</button>
          </div>
          <div class="usuals">
            <button v-for="u in usuals" :key="u.name" type="button" :class="{ on: u.on }" @pointerdown.prevent @click="add(u.name)">
              {{ u.name }}<span v-if="u.on"> ✓{{ u.on.qty > 1 ? ' ×' + u.on.qty : '' }}</span>
            </button>
          </div>
          <template v-if="S.templates.length">
            <div class="panel-title">{{ t('add.templates') }}</div>
            <div class="usuals">
              <button v-for="tp in S.templates" :key="tp.id" type="button" @pointerdown.prevent @click="addMany(tp.items)">{{ tp.name }}</button>
            </div>
          </template>
          <div class="panel-hint">{{ t('add.hint') }}</div>
        </div>
      </Transition>
      <input
        ref="input" v-model="query" type="text" :placeholder="t('add.placeholder')" enterkeyhint="done"
        autocomplete="off" autocapitalize="sentences" @focus="onFocus" @blur="onBlur" @keydown.esc="closePanel"
      />
      <button type="submit" class="primary" :disabled="!query.trim()" @pointerdown.prevent>{{ t('add.button') }}</button>
    </form>

    <Transition name="toast">
      <div v-if="toast" :key="toast.key" class="toast">
        <span>{{ toast.text }}</span>
        <button v-if="toast.undo" class="link" @click="undo">{{ t('toast.undo') }}</button>
      </div>
    </Transition>

    <Transition name="sheet" :duration="320">
      <EditSheet v-if="editing" :key="editing.id" :item="editing" :meta="meta" @close="editing = null" @save="save" @remove="drop(editing)" />
    </Transition>

    <Transition name="sheet" :duration="320">
      <TripsSheet v-if="showTrips" :store-name="storeName" :pending="open" @close="showTrips = false" @add="addMany" @remove-trip="deleteTrip" />
    </Transition>
    <Transition name="sheet" :duration="320">
      <FinishSheet
        v-if="showFinish" :n="done.length" :left="open.length" :where="store === 'all' ? '' : storeName(store)"
        @close="showFinish = false" @finish="finish"
      />
    </Transition>
    <Transition name="sheet" :duration="320">
      <StoresSheet v-if="showStores" :stores="meta.stores" :items="S.items" @close="showStores = false" @created="(s) => say(t('stores.created', { name: s.name }))" />
    </Transition>

    <div v-if="!S.auth" class="gate">
      <form @submit.prevent="setToken(tokenText)">
        <h2>{{ t('gate.title') }}</h2>
        <p v-html="t('gate.text')"></p>
        <input v-model="tokenText" type="password" autocomplete="current-password" />
        <button class="primary" :disabled="!tokenText.trim()">{{ t('gate.enter') }}</button>
      </form>
    </div>
  </div>
</template>
