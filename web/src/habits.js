// Cálculos sobre el historial de compras: "Se te suele acabar" y estadísticas.
const DAY = 864e5;
const key = (s) => s.trim().toLowerCase();
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const dayOf = (iso) => { const d = new Date(iso); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

// "Se te suele acabar": productos comprados al menos 3 días distintos, con su intervalo típico (mediana),
// cuyo tiempo desde la última compra ya llega a ese intervalo (con un poco de margen). Excluye lo que ya está
// en la lista. Lo más "pasado de fecha" primero.
export function dueSoon(trips, items, now = Date.now(), max = 8) {
  const inList = new Set(items.map((x) => key(x.name)));
  const by = {};
  for (const t of trips) {
    const d = dayOf(t.finished_at);
    for (const x of t.items) {
      const k = key(x.name);
      if (inList.has(k)) continue;
      const p = by[k] || (by[k] = { name: x.name, days: new Set() });
      p.days.add(d);
    }
  }
  const today = dayOf(new Date(now).toISOString());
  const out = [];
  for (const p of Object.values(by)) {
    if (p.days.size < 3) continue;
    const days = [...p.days].sort((a, b) => a - b);
    const every = median(days.slice(1).map((d, i) => (d - days[i]) / DAY));
    if (every < 2) continue; // lo de "cada día" no aporta
    const since = (today - days[days.length - 1]) / DAY;
    if (since >= every * 0.85) out.push({ name: p.name, every: Math.round(every), since, ratio: since / every });
  }
  return out.sort((a, b) => b.ratio - a.ratio).slice(0, max);
}

// ------------------------------------------------------------ estadísticas
const monthKey = (iso) => { const d = new Date(iso); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

export function stats(trips, now = new Date()) {
  // Últimos 6 meses (del más antiguo al actual): gasto y nº de compras
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), date: d, spent: 0, trips: 0, priced: 0 });
  }
  const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
  const stores = {}, products = {};
  for (const t of trips) {
    const i = idx[monthKey(t.finished_at)];
    if (i != null) {
      months[i].trips++;
      if (t.total != null) { months[i].spent += t.total; months[i].priced++; }
    }
    const s = stores[t.store || ''] || (stores[t.store || ''] = { store: t.store, trips: 0, spent: 0 });
    s.trips++;
    if (t.total != null) s.spent += t.total;
    for (const x of t.items) {
      const k = key(x.name);
      const p = products[k] || (products[k] = { name: x.name, cat: x.cat, times: 0 });
      p.times++;
    }
  }
  // Cada cuánto vas: mediana de días entre compras (días distintos)
  const days = [...new Set(trips.map((t) => dayOf(t.finished_at)))].sort((a, b) => a - b);
  const every = days.length > 2 ? median(days.slice(1).map((d, i) => (d - days[i]) / DAY)) : null;
  // Media mensual: meses (de los 6) con algún importe apuntado
  const priced = months.filter((m) => m.priced);
  return {
    months,
    thisMonth: months[5],
    lastMonth: months[4],
    avgMonth: priced.length ? priced.reduce((s, m) => s + m.spent, 0) / priced.length : null,
    avgTrip: (() => { const p = trips.filter((t) => t.total != null); return p.length ? p.reduce((s, t) => s + t.total, 0) / p.length : null; })(),
    every,
    hasTotals: trips.some((t) => t.total != null),
    stores: Object.values(stores).sort((a, b) => b.trips - a.trips),
    top: Object.values(products).sort((a, b) => b.times - a.times).slice(0, 10),
    count: trips.length,
  };
}

export const eur = (n, loc = 'es-ES') => (n == null ? '—' : new Intl.NumberFormat(loc, { style: 'currency', currency: 'EUR' }).format(n));
