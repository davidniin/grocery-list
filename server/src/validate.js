// Validación de lo que llega por la API (del móvil o del dashboard). Funciones puras: sin base de datos.
import { STORE_IDS } from './catalog.js';

export const LIMITS = { id: 64, name: 120, cat: 40, note: 500, templateName: 60, storeName: 40, stores: 30, templateItems: 200, listItems: 1000 };

export function newId() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Identificador que pone el cliente (o viene en la URL): texto, recortado
export function cleanId(v) { return String(v ?? '').trim().slice(0, LIMITS.id); }

// Tiendas que existen. Empiezan siendo las de catalog.js; al arrancar y con cada cambio se cargan de la base de
// datos (db.js, loadStores()). Un solo proceso: basta con tenerlas en memoria.
const storeIds = new Set(STORE_IDS);
export function setStoreIds(ids) { storeIds.clear(); for (const id of ids) storeIds.add(id); }

// Tienda: una de las conocidas, o null
export function cleanStore(v) { return v && storeIds.has(String(v)) ? String(v) : null; }

// Nombre de una tienda nueva o renombrada: texto recortado, sin espacios de más
export function cleanStoreName(v) { return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.storeName); }

// Deja solo campos conocidos y con el tipo correcto. partial = solo los campos que vienen (PATCH).
export function clean(x, partial) {
  const o = {};
  if (!x || typeof x !== 'object') x = {};
  if ('name' in x) o.name = String(x.name ?? '').trim().slice(0, LIMITS.name);
  if ('cat' in x) o.cat = String(x.cat ?? '').trim().slice(0, LIMITS.cat) || 'Otros';
  if ('qty' in x) o.qty = Math.max(1, Math.min(999, Math.round(+x.qty) || 1));
  if ('store' in x) o.store = cleanStore(x.store);
  if ('done' in x) o.done = !!x.done;
  if ('note' in x) o.note = String(x.note ?? '').slice(0, LIMITS.note);
  if (partial) return o;
  return Object.assign({ cat: 'Otros', qty: 1, store: null, done: false, note: '' }, o, { id: cleanId(x.id) || newId() });
}

// Importe en euros: número ≥ 0 con 2 decimales (acepta "12,50"), o null
export function money(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? +v.replace(',', '.') : +v;
  return !Number.isFinite(n) || n < 0 || n > 1e6 ? null : Math.round(n * 100) / 100;
}

// Tipo real de una imagen por sus primeros bytes (no se fía del Content-Type que manda el cliente)
export function imageType(buf) {
  const b = buf.subarray(0, 16);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 12 && b.toString('latin1', 4, 8) === 'ftyp') {
    const brand = b.toString('latin1', 8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';
  }
  return null;
}
