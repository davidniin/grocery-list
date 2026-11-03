// Lista local + cola de cambios pendientes. En el súper la cobertura va y viene: cada cambio se ve al momento,
// se guarda en la cola (localStorage) y se envía en orden cuando hay red. Mientras haya cambios en cola no se
// recarga la lista del servidor (no se pisa lo local). Sin cambios pendientes, se consulta cada 5 s.
//
// Demo (build "npm run build:site", para la landing): datos inventados de demo.js, sin servidor ni clave. Los cambios
// se quedan en esta pestaña (sessionStorage) y nunca se envían a ningún sitio.
import { reactive } from 'vue';
import { META as DEMO_META, demoData } from './demo.js';

export const DEMO = __DEMO__; // constante de compilación (vite.config.js): en la app normal se elimina demo.js
const PREFIX = DEMO ? 'compra-demo.' : 'compra.';
const box = () => (DEMO ? sessionStorage : localStorage);
function load(k, def) { try { const v = box().getItem(PREFIX + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
function save(k, v) { try { box().setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
if (DEMO && !load('items', null)) for (const [k, v] of Object.entries(demoData())) save(k, v);

// Token: se puede pasar una vez como /#token=... (se guarda y se quita de la barra de direcciones). Va en el
// fragmento (#), que el navegador nunca envía al servidor: no queda en logs ni en Cloudflare.
const q = new URLSearchParams(location.hash.slice(1));
if (q.has('token')) {
  save('token', q.get('token'));
  history.replaceState(null, '', location.pathname + location.search);
}

export const S = reactive({
  items: load('items', []),
  queue: load('queue', []),
  meta: load('meta', null),
  products: load('products', []),
  trips: load('trips', []), // historial de compras finalizadas (con importe y si tiene foto del ticket)
  templates: load('templates', []), // plantillas: vienen en el documento de la lista (data.templates)
  version: -1,
  online: true,
  auth: true, // false = falta el token o no vale
});

function persist() {
  save('items', S.items); save('queue', S.queue); save('trips', S.trips); save('templates', S.templates);
  if (DEMO) save('products', S.products); // sin servidor, lo aprendido se guarda aquí
}

function authHeaders() {
  const token = load('token', '');
  return token ? { Authorization: 'Bearer ' + token } : {};
}

async function call(method, path, body) {
  const h = authHeaders();
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
    S.auth = r.status !== 401;
    S.online = true;
    return r;
  } catch (e) {
    S.online = false;
    throw e;
  } finally { clearTimeout(t); }
}

function apply(doc) {
  S.version = doc.version;
  S.items = doc.data.items;
  if (doc.data.templates) S.templates = doc.data.templates;
  persist();
}

// ------------------------------------------------------------ envío de la cola
let flushing = null;
export function flush() { return flushing || (flushing = run().finally(() => { flushing = null; })); }
async function run() {
  if (DEMO) return;
  while (S.queue.length) {
    const op = S.queue[0];
    let r;
    try { r = await call(op.method, op.path, op.body); } catch (e) { return; }
    if (r.status === 401 || r.status >= 500) return; // se reintenta más tarde
    // 2xx, o 4xx (p. ej. ya lo borró otra persona): fuera de la cola
    S.queue.shift();
    persist();
    if (r.ok && !S.queue.length) apply(await r.json());
  }
}

export async function pull() {
  if (DEMO) return;
  await flush();
  if (S.queue.length) return;
  try {
    const r = await call('GET', '/v1/list');
    if (!r.ok) return;
    const doc = await r.json();
    if (doc.version !== S.version && !S.queue.length) apply(doc);
  } catch (e) { /* sin red: seguimos con lo local */ }
}

async function loadMeta() {
  if (DEMO) { S.meta = DEMO_META; return; }
  try {
    const [m, p] = await Promise.all([call('GET', '/v1/meta'), call('GET', '/v1/products')]);
    if (m.ok) save('meta', S.meta = await m.json());
    if (p.ok) save('products', S.products = await p.json());
  } catch (e) { /* sin red: se usan los guardados */ }
}

// ------------------------------------------------------------ cambios (se ven al momento, se envían después)
function enqueue(method, path, body) {
  if (DEMO) { persist(); return; } // en la demo no hay servidor: el cambio ya está en S
  S.queue.push(body === undefined ? { method, path } : { method, path, body });
  persist();
  flush();
}
export function newId() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export function addItem(it) {
  S.items.push(it);
  const key = it.name.toLowerCase();
  if (!S.products.some((p) => p.name.toLowerCase() === key)) S.products.push({ name: it.name, cat: it.cat, store: it.store });
  enqueue('POST', '/v1/list/items', Object.assign({}, it));
}
export function update(it, fields) {
  // `it` puede ser de antes de una recarga (p. ej. al deshacer): se cambia el que hay ahora en la lista
  Object.assign(S.items.find((x) => x.id === it.id) || it, fields);
  enqueue('PATCH', '/v1/list/items/' + encodeURIComponent(it.id), fields);
}
export function remove(it) {
  S.items = S.items.filter((x) => x.id !== it.id);
  enqueue('DELETE', '/v1/list/items/' + encodeURIComponent(it.id));
}
export function clearDone(store) {
  S.items = S.items.filter((x) => !x.done || (store && x.store !== store));
  enqueue('POST', '/v1/list/clear-done' + (store ? '?store=' + encodeURIComponent(store) : ''));
}
// ------------------------------------------------------------ compra finalizada e historial
// Lo tachado (de la tienda indicada, o de todas) pasa al historial; lo que no se encontró se queda en la lista.
export function finishTrip(store, total) {
  const items = S.items.filter((x) => x.done && (!store || x.store === store));
  if (!items.length) return null;
  const trip = {
    id: newId(), store: store || null, n: items.length, finished_at: new Date().toISOString(), total: total ?? null, receipt: false,
    items: items.map(({ id, name, cat, qty, store: st, note }) => ({ id, name, cat, qty, store: st, note })),
  };
  S.items = S.items.filter((x) => !items.includes(x));
  S.trips.unshift(trip);
  enqueue('POST', '/v1/list/finish', { id: trip.id, store: trip.store, total: trip.total });
  return trip;
}
export function undoTrip(trip) {
  S.items.push(...trip.items.map((x) => Object.assign({}, x, { done: true })));
  S.trips = S.trips.filter((t) => t.id !== trip.id);
  enqueue('POST', '/v1/trips/' + encodeURIComponent(trip.id) + '/undo');
}
export function deleteTrip(trip) {
  S.trips = S.trips.filter((t) => t.id !== trip.id);
  enqueue('DELETE', '/v1/trips/' + encodeURIComponent(trip.id));
}
export function setTripTotal(trip, total) {
  const t = S.trips.find((x) => x.id === trip.id);
  if (t) t.total = total;
  enqueue('PATCH', '/v1/trips/' + encodeURIComponent(trip.id), { total });
}

// Foto del ticket: necesita red. Antes se envía la cola (la compra tiene que existir ya en el servidor).
const demoReceipts = {}; // demo: la foto se queda en memoria (se pierde al recargar)
export async function uploadReceipt(trip, file) {
  if (DEMO) {
    demoReceipts[trip.id] = await shrink(file);
    const t = S.trips.find((x) => x.id === trip.id);
    if (t) { t.receipt = Date.now(); persist(); }
    return;
  }
  await flush();
  if (S.queue.some((q) => q.path === '/v1/list/finish' && q.body && q.body.id === trip.id)) throw new Error('Sin conexión: añade el ticket luego desde el historial');
  const blob = await shrink(file);
  const fd = new FormData();
  fd.append('file', blob, 'ticket.jpg');
  let r;
  try { r = await fetch('/v1/trips/' + encodeURIComponent(trip.id) + '/receipt', { method: 'POST', headers: authHeaders(), body: fd }); } catch (e) { S.online = false; throw new Error('Sin conexión: añade el ticket luego desde el historial', { cause: e }); }
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))).error) || 'No se ha podido subir el ticket');
  const t = S.trips.find((x) => x.id === trip.id);
  if (t) { t.receipt = Date.now(); persist(); } // el número sirve también para no ver la foto vieja en caché
}
export function deleteReceipt(trip) {
  const t = S.trips.find((x) => x.id === trip.id);
  if (t) t.receipt = false;
  enqueue('DELETE', '/v1/trips/' + encodeURIComponent(trip.id) + '/receipt');
}
// La foto se descarga con fetch (con la cabecera de acceso, nunca con el token en la URL) y se muestra como blob:.
// ?v= cambia al subir otra foto, para no ver la vieja de la caché del navegador.
export async function fetchReceipt(trip) {
  if (DEMO) { if (demoReceipts[trip.id]) return demoReceipts[trip.id]; throw new Error('En la demo la foto no se guarda al recargar'); }
  const r = await call('GET', '/v1/trips/' + encodeURIComponent(trip.id) + '/receipt?v=' + (+trip.receipt || 1));
  if (!r.ok) throw new Error('No se ha podido cargar el ticket');
  return r.blob();
}
// Reduce la foto a ~1600 px en JPEG (un ticket se lee bien y ocupa ~200 KB)
async function shrink(file, max = 1600) {
  try {
    const img = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
    return out || file;
  } catch (e) { return file; }
}

// ------------------------------------------------------------ plantillas
export function saveTemplate(tpl) {
  const i = S.templates.findIndex((x) => x.id === tpl.id);
  if (i >= 0) S.templates[i] = tpl; else S.templates.push(tpl);
  enqueue('PUT', '/v1/templates/' + encodeURIComponent(tpl.id), { name: tpl.name, items: tpl.items });
}
export function deleteTemplate(tpl) {
  S.templates = S.templates.filter((x) => x.id !== tpl.id);
  enqueue('DELETE', '/v1/templates/' + encodeURIComponent(tpl.id));
}

export async function loadTrips() {
  if (DEMO) return;
  try {
    const r = await call('GET', '/v1/trips');
    if (r.ok && !S.queue.length) {
      // receipt: el servidor dice true/false; si aquí ya hay una marca de subida (número), se conserva
      const old = Object.fromEntries(S.trips.map((t) => [t.id, t.receipt]));
      S.trips = (await r.json()).map((t) => Object.assign(t, { receipt: t.receipt && (+old[t.id] || true) }));
      persist();
    }
  } catch (e) { /* sin red: el historial guardado */ }
}

export function setToken(t) {
  save('token', t.trim());
  S.auth = true;
  loadMeta();
  pull();
}

// Demo: vuelve a los datos inventados del principio
export function resetDemo() {
  try { for (const k of Object.keys(sessionStorage)) if (k.startsWith(PREFIX)) sessionStorage.removeItem(k); } catch (e) { /* nada */ }
  location.reload();
}

export function start() {
  if (DEMO) { S.version = 0; loadMeta(); return; }
  loadMeta();
  pull().then(loadTrips); // el historial alimenta "Se te suele acabar" y las estadísticas
  setInterval(() => { if (!document.hidden) pull(); }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
  window.addEventListener('online', pull);
}
