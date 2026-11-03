// Datos fijos de la app: tiendas, pasillos y su orden por tienda, habituales de partida y catálogo inicial.
// El dashboard de la tablet los lee de GET /v1/meta, así que solo se cambian aquí.

export const STORES = [{ id: 'super', name: 'Mercadona' }, { id: 'bonpreu', name: 'Bonpreu' }];
export const STORE_IDS = new Set(STORES.map((s) => s.id));

export const CATS = ['Fruta y verdura', 'Panadería', 'Carne y pescado', 'Lácteos y huevos', 'Despensa', 'Congelados', 'Picoteo', 'Hogar'];
export const CAT_ORDER = {
  all: CATS,
  super: CATS,
  bonpreu: ['Hogar', 'Despensa', 'Picoteo', 'Lácteos y huevos', 'Carne y pescado', 'Congelados', 'Fruta y verdura', 'Panadería'],
};

// Habituales de partida. Se completan con lo que más se compra de verdad.
export const USUALS = ['Leche semidesnatada', 'Huevos', 'Plátanos', 'Pan', 'Manzanas', 'Café en grano', 'Yogur griego', 'Queso curado', 'Mantequilla', 'Espinacas', 'Muslos de pollo', 'Papel de cocina'];

// Catálogo inicial para las sugerencias (solo se carga si la tabla de productos está vacía).
// Después aprende solo: cada producto que se añade queda con su categoría y tienda.
export const CATALOG = [
  ['Manzanas', 'Fruta y verdura'], ['Aguacates', 'Fruta y verdura'], ['Plátanos', 'Fruta y verdura'], ['Espinacas', 'Fruta y verdura'], ['Arándanos', 'Fruta y verdura'],
  ['Brócoli', 'Fruta y verdura'], ['Zanahorias', 'Fruta y verdura'], ['Pepino', 'Fruta y verdura'], ['Ajos', 'Fruta y verdura'], ['Uvas', 'Fruta y verdura'],
  ['Limones', 'Fruta y verdura'], ['Limas', 'Fruta y verdura'], ['Cebollas', 'Fruta y verdura'], ['Patatas', 'Fruta y verdura'], ['Fresas', 'Fruta y verdura'],
  ['Tomates', 'Fruta y verdura'], ['Pan', 'Panadería'], ['Panecillos', 'Panadería'], ['Cruasanes', 'Panadería'], ['Pan de payés', 'Panadería'],
  ['Tortillas de trigo', 'Panadería'], ['Pan de hamburguesa', 'Panadería'], ['Bacon', 'Carne y pescado'], ['Pechugas de pollo', 'Carne y pescado'],
  ['Muslos de pollo', 'Carne y pescado'], ['Carne picada', 'Carne y pescado'], ['Salmón', 'Carne y pescado'], ['Gambas', 'Carne y pescado'],
  ['Mantequilla', 'Lácteos y huevos'], ['Queso curado', 'Lácteos y huevos'], ['Queso fresco', 'Lácteos y huevos'], ['Huevos', 'Lácteos y huevos'],
  ['Yogur griego', 'Lácteos y huevos'], ['Leche semidesnatada', 'Lácteos y huevos'], ['Bebida de avena', 'Lácteos y huevos'], ['Parmesano', 'Lácteos y huevos'],
  ['Alubias', 'Despensa'], ['Cereales', 'Despensa'], ['Café en grano', 'Despensa'], ['Harina', 'Despensa'], ['Miel', 'Despensa'],
  ['Garbanzos', 'Despensa'], ['Aceite de oliva', 'Despensa'], ['Tomate frito', 'Despensa'], ['Crema de cacahuete', 'Despensa'], ['Arroz', 'Despensa'],
  ['Macarrones', 'Despensa'], ['Espaguetis', 'Despensa'], ['Azúcar', 'Despensa'], ['Té', 'Despensa'], ['Guisantes congelados', 'Congelados'],
  ['Frutos rojos congelados', 'Congelados'], ['Helado', 'Congelados'], ['Pizza', 'Congelados'], ['Gofres', 'Congelados'], ['Patatas fritas', 'Picoteo'],
  ['Crackers', 'Picoteo'], ['Chocolate negro', 'Picoteo'], ['Galletas', 'Picoteo'], ['Barritas de cereales', 'Picoteo'],
  ['Palomitas', 'Picoteo'], ['Lavavajillas', 'Hogar'], ['Pastillas lavavajillas', 'Hogar'], ['Bolsas de basura', 'Hogar'],
  ['Detergente', 'Hogar'], ['Papel de cocina', 'Hogar'], ['Papel higiénico', 'Hogar'], ['Pasta de dientes', 'Hogar'],
];
