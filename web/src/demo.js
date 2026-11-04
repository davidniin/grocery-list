// Datos inventados para la demo de la landing (npm run build:site): la app funciona sin servidor y sin clave.
// Las fechas son relativas a hoy para que el historial, "Se te suele acabar" y las estadísticas parezcan actuales.
// En español o en inglés (productos y tiendas; los pasillos se guardan siempre en español, como en la app real).
// META es una copia de lo que devuelve GET /v1/meta (server/src/catalog.js); si cambia allí, cámbialo aquí.

const STORES = {
  es: [{ id: 'super', name: 'Mercadona' }, { id: 'bonpreu', name: 'Bonpreu' }],
  en: [{ id: 'super', name: 'Supermarket' }, { id: 'bonpreu', name: 'Corner shop' }],
};
const CATS = ['Fruta y verdura', 'Panadería', 'Carne y pescado', 'Lácteos y huevos', 'Despensa', 'Congelados', 'Picoteo', 'Hogar'];
const META = {
  cats: CATS,
  catOrder: {
    all: CATS,
    super: CATS,
    bonpreu: ['Hogar', 'Despensa', 'Picoteo', 'Lácteos y huevos', 'Carne y pescado', 'Congelados', 'Fruta y verdura', 'Panadería'],
  },
  usuals: ['Leche semidesnatada', 'Huevos', 'Plátanos', 'Pan', 'Manzanas', 'Café en grano', 'Yogur griego', 'Queso curado'],
};

// [nombre, pasillo, tienda, cada cuántas compras se compra, fase]. Fase 1 = la última vez fue hace un ciclo
// entero (sale en "Se te suele acabar"); fase 0 = se compró en la última compra.
const P = [
  ['Leche semidesnatada', 'Lácteos y huevos', 'super', 1, 0], ['Pan', 'Panadería', 'super', 1, 0],
  ['Plátanos', 'Fruta y verdura', 'super', 2, 0], ['Huevos', 'Lácteos y huevos', 'super', 2, 0],
  ['Yogur griego', 'Lácteos y huevos', 'super', 2, 1], ['Tomates', 'Fruta y verdura', 'super', 2, 0],
  ['Manzanas', 'Fruta y verdura', 'super', 3, 0], ['Pechugas de pollo', 'Carne y pescado', 'super', 3, 0],
  ['Café en grano', 'Despensa', 'bonpreu', 4, 1], ['Aceite de oliva', 'Despensa', 'bonpreu', 6, 1],
  ['Queso curado', 'Lácteos y huevos', 'super', 3, 0], ['Papel de cocina', 'Hogar', 'super', 5, 0],
  ['Pastillas lavavajillas', 'Hogar', 'bonpreu', 7, 0], ['Arroz', 'Despensa', 'super', 6, 0],
  ['Espinacas', 'Fruta y verdura', 'super', 3, 0], ['Salmón', 'Carne y pescado', 'super', 4, 0],
  ['Macarrones', 'Despensa', 'super', 5, 0], ['Chocolate negro', 'Picoteo', 'bonpreu', 4, 0],
  ['Detergente', 'Hogar', 'bonpreu', 8, 0], ['Guisantes congelados', 'Congelados', 'super', 6, 0],
];
// Nombres en inglés de los productos inventados
const EN = {
  'Leche semidesnatada': 'Semi-skimmed milk', Pan: 'Bread', Plátanos: 'Bananas', Huevos: 'Eggs', 'Yogur griego': 'Greek yoghurt',
  Tomates: 'Tomatoes', Manzanas: 'Apples', 'Pechugas de pollo': 'Chicken breasts', 'Café en grano': 'Coffee beans',
  'Aceite de oliva': 'Olive oil', 'Queso curado': 'Cheddar', 'Papel de cocina': 'Kitchen roll', 'Pastillas lavavajillas': 'Dishwasher tablets',
  Arroz: 'Rice', Espinacas: 'Spinach', Salmón: 'Salmon', Macarrones: 'Penne', 'Chocolate negro': 'Dark chocolate',
  Detergente: 'Laundry detergent', 'Guisantes congelados': 'Frozen peas', Aguacates: 'Avocados', Fresas: 'Strawberries',
  'Pan de payés': 'Sourdough loaf', 'Carne picada': 'Minced beef', Gambas: 'Prawns', Parmesano: 'Parmesan', 'Tomate frito': 'Tomato sauce',
  Espaguetis: 'Spaghetti', Helado: 'Ice cream', 'Patatas fritas': 'Crisps', 'Bolsas de basura': 'Bin bags', Cebollas: 'Onions',
  Limones: 'Lemons', Cruasanes: 'Croissants', Bacon: 'Bacon', Mantequilla: 'Butter', Garbanzos: 'Chickpeas', Miel: 'Honey', Pizza: 'Pizza',
  Galletas: 'Biscuits', 'Papel higiénico': 'Toilet paper', 'Pasta de dientes': 'Toothpaste', 'Muslos de pollo': 'Chicken thighs',
  'Pan de hamburguesa': 'Burger buns', maduros: 'ripe', Desayunos: 'Breakfasts', Barbacoa: 'Barbecue',
};

const PRICE = { 'Aceite de oliva': 8.9, 'Café en grano': 6.5, Salmón: 7.8, 'Pechugas de pollo': 5.4, Detergente: 9.9, 'Pastillas lavavajillas': 6.2, 'Queso curado': 5.1 };

const ago = (days, hour) => { const d = new Date(Date.now() - days * 864e5); d.setHours(hour, (days * 7) % 60, 0, 0); return d.toISOString(); };
let seq = 0;
const id = (p) => 'demo-' + p + (seq++).toString(36);
const item = ([name, cat, store], qty = 1) => ({ id: id('i'), name, cat, qty, store, note: '' });

export function demoData(lang = 'es') {
  const tr = (x) => (lang === 'en' && EN[x]) || x;
  const out = demoDataEs();
  const name = (x) => Object.assign(x, { name: tr(x.name) });
  for (const x of out.items) { name(x); x.note = tr(x.note); }
  for (const tp of out.trips) tp.items.forEach(name);
  out.products.forEach(name);
  for (const tp of out.templates) { name(tp); tp.items.forEach(name); }
  out.meta = { stores: STORES[lang] || STORES.es, cats: META.cats, catOrder: META.catOrder, usuals: META.usuals.map(tr) };
  return out;
}

function demoDataEs() {
  // Una compra cada 4 días durante ~6 meses (i = 0 es la más reciente, hace 3 días)
  const trips = [];
  for (let i = 0; i < 45; i++) {
    const store = i % 3 === 2 ? 'bonpreu' : 'super';
    const items = P.filter(([, , , every, phase]) => (i + phase) % every === 0)
      .map((p) => item([p[0], p[1], store], p[0] === 'Leche semidesnatada' ? 6 : 1));
    const total = items.reduce((s, x) => s + (PRICE[x.name] || 1.6 + ((x.name.length * 37) % 25) / 10) * x.qty, 0);
    trips.push({ id: id('t'), store, n: items.length, finished_at: ago(3 + i * 4, 18 + (i % 3)), total: i % 7 === 4 ? null : Math.round(total * 100) / 100, receipt: false, items });
  }

  const list = [
    ['Aguacates', 'Fruta y verdura', 'super', 3], ['Fresas', 'Fruta y verdura', 'super'], ['Pan de payés', 'Panadería', 'bonpreu'],
    ['Carne picada', 'Carne y pescado', 'super'], ['Gambas', 'Carne y pescado', 'bonpreu'], ['Leche semidesnatada', 'Lácteos y huevos', 'super', 6],
    ['Parmesano', 'Lácteos y huevos', 'bonpreu'], ['Tomate frito', 'Despensa', 'super', 2], ['Espaguetis', 'Despensa', 'super'],
    ['Helado', 'Congelados', 'super'], ['Patatas fritas', 'Picoteo', 'super'], ['Bolsas de basura', 'Hogar', 'bonpreu'],
  ].map(([name, cat, store, qty]) => Object.assign(item([name, cat, store], qty || 1), { done: false }));
  list[0].note = 'maduros';
  for (const i of [1, 5, 10]) list[i].done = true; // algo ya en el carro

  // Productos conocidos (sugerencias y habituales): los del historial con sus usos, más algunos del catálogo
  const uses = {};
  for (const t of trips) for (const x of t.items) uses[x.name] = (uses[x.name] || 0) + 1;
  const products = P.map(([name, cat, store]) => ({ name, cat, store, uses: uses[name] || 0 }))
    .concat(list.filter((x) => !uses[x.name]).map(({ name, cat, store }) => ({ name, cat, store, uses: 0 })))
    .concat([['Cebollas', 'Fruta y verdura'], ['Limones', 'Fruta y verdura'], ['Cruasanes', 'Panadería'], ['Bacon', 'Carne y pescado'], ['Mantequilla', 'Lácteos y huevos'],
      ['Garbanzos', 'Despensa'], ['Miel', 'Despensa'], ['Pizza', 'Congelados'], ['Galletas', 'Picoteo'], ['Papel higiénico', 'Hogar'], ['Pasta de dientes', 'Hogar']]
      .map(([name, cat]) => ({ name, cat, store: 'super', uses: 0 })))
    .sort((a, b) => b.uses - a.uses);

  const templates = [
    { id: 'demo-tpl1', name: 'Desayunos', items: [['Leche semidesnatada', 'Lácteos y huevos', 'super', 6], ['Pan', 'Panadería', 'super'], ['Café en grano', 'Despensa', 'bonpreu'], ['Plátanos', 'Fruta y verdura', 'super']]
      .map(([name, cat, store, qty]) => ({ name, cat, store, qty: qty || 1 })) },
    { id: 'demo-tpl2', name: 'Barbacoa', items: [['Muslos de pollo', 'Carne y pescado', 'super', 2], ['Pan de hamburguesa', 'Panadería', 'super'], ['Patatas fritas', 'Picoteo', 'super', 2], ['Limones', 'Fruta y verdura', 'super']]
      .map(([name, cat, store, qty]) => ({ name, cat, store, qty: qty || 1 })) },
  ];

  return { items: list, trips, products, templates };
}
