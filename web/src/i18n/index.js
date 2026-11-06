// Idioma de la app: español o inglés. Se elige solo según el idioma del móvil, se puede cambiar abajo en la lista
// y también con ?lang=en / ?lang=es en la dirección (la landing abre así la demo en su mismo idioma).
// Los textos están en es.js y en.js con las mismas claves (web/test/i18n.test.js lo comprueba).
// Lo que no se traduce: los productos y las tiendas (son datos de cada casa). Los pasillos se guardan en español
// (así los lee también el dashboard) y solo se traduce cómo se muestran (claves "cat.*").
import { ref } from 'vue';
import es from './es.js';
import en from './en.js';

export const LANGS = { es: 'Español', en: 'English' };
const DICTS = { es, en };
const KEY = 'compra.lang';

function initial() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q in DICTS) { localStorage.setItem(KEY, q); return q; }
    const saved = localStorage.getItem(KEY);
    if (saved in DICTS) return saved;
  } catch (e) { /* sin almacenamiento */ }
  return (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export const lang = ref(initial());
document.documentElement.lang = lang.value;

export function setLang(l) {
  if (!(l in DICTS)) return;
  lang.value = l;
  document.documentElement.lang = l;
  try { localStorage.setItem(KEY, l); } catch (e) { /* sin almacenamiento */ }
}

// t('clave', { n: 3, name: 'Pan' }): {name} se sustituye; "uno|varios" elige según n
export function t(key, params) {
  let s = DICTS[lang.value][key] ?? es[key] ?? key;
  if (params) {
    if (s.includes('|') && 'n' in params) s = s.split('|')[params.n === 1 ? 0 : 1];
    s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m));
  }
  return s;
}

// Nombre visible de un pasillo (los que no están en el diccionario, tal cual)
export const catLabel = (c) => DICTS[lang.value]['cat.' + c] ?? c;
export const locale = () => (lang.value === 'es' ? 'es-ES' : 'en-GB');
