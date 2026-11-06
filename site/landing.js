// Grocery list landing page: language (EN/ES), repository links and the live demo (lazy iframe).
// Every GitHub link on the page comes from here. The demo opens in the same language as the page.
const REPO = 'https://github.com/davidniin/grocery-list';

const ES = {
  'brand': 'La compra',
  'nav.features': 'Funciones', 'nav.demo': 'Demo', 'nav.install': 'Instalar', 'nav.github': 'GitHub',
  'hero.eyebrow': 'Gratis · código abierto · autoalojada',
  'hero.title': 'La lista de la compra de toda la casa.<br /><span>Pensada para el pasillo del súper.</span>',
  'hero.lead': 'Una sola lista para todos en casa, ordenada como recorres cada supermercado. Tacha con un dedo, sigue aunque no haya cobertura y mira cuánto gastas y qué está a punto de acabarse.',
  'hero.try': 'Probar la demo en vivo', 'hero.install': 'Instala la tuya',
  'hero.p1': 'Funciona sin cobertura', 'hero.p2': 'Con una mano', 'hero.p3': 'Aprende lo que compras', 'hero.p4': 'Sin rastreo', 'hero.p5': 'Español · English',
  'demo.open': 'Abrir la demo en vivo',
  'demo.note': 'Demo en vivo con datos inventados. Añade «leche x2, pan», desliza productos al carro, finaliza la compra, crea una tienda… No se guarda nada.',
  'demo.full': 'Abrir a pantalla completa ↗',
  'features.title': 'Todo para la compra de la semana, y nada más',
  'f1.t': 'Por pasillos y por tienda', 'f1.d': 'La lista se ordena sola como recorres el súper. Añade tus propias tiendas, cada una con su pestaña.',
  'f2.t': 'Desliza al carro', 'f2.d': 'Toca o desliza a la derecha para tachar, a la izquierda para borrar, mantén pulsado para editar. Todo se puede deshacer.',
  'f3.t': 'Añade en segundos', 'f3.d': '«leche x2, pan, huevos x12» de una vez, sugerencias mientras escribes, tus habituales a un toque y productos nuevos con su pasillo.',
  'f4.t': 'Sin cobertura', 'f4.d': 'Los cambios se ven al momento, se guardan en el móvil y se envían cuando vuelve la red.',
  'f5.t': 'Compartida en casa', 'f5.d': 'Todos ven la misma lista en segundos, en el móvil y en el dashboard de la tablet de la cocina.',
  'f6.t': 'Historial y tickets', 'f6.d': '«Compra finalizada» guarda la compra con el importe y la foto del ticket. Repite cualquier compra pasada.',
  'f7.t': 'Se te suele acabar', 'f7.d': 'Aprende cada cuánto compras cada cosa y te la sugiere cuando toca.',
  'f8.t': 'Estadísticas y plantillas', 'f8.d': 'Gasto por mes y tienda, cada cuánto vas, lo que más compras y plantillas para las listas que repites.',
  'privacy.title': 'Tu lista, en tu servidor',
  'privacy.lead': 'No es un servicio en el que te registras: cada casa monta su propia copia. Sin cuenta, sin anuncios, sin analítica.',
  'privacy.c1': 'La lista, el historial y las fotos de los tickets están en tu PostgreSQL, así que entran en tus copias.',
  'privacy.c2': 'Acceso con clave o con Cloudflare Access, comprobado por la propia app: sin ninguno, no arranca.',
  'privacy.c3': 'Cabeceras de seguridad estrictas y un contenedor de solo lectura y sin privilegios.',
  'privacy.c4': 'Código abierto (MIT): puedes leer cada línea.',
  'install.title': 'Instala la tuya',
  'install.lead': 'Un contenedor Docker (web + API) junto a PostgreSQL. En casa, en un NAS, una Raspberry Pi o un VPS.',
  'install.s1': 'Descarga y compila', 'install.s2': 'Conéctala a PostgreSQL',
  'install.s2d': 'Pon DATABASE_URL y un GROCERY_TOKEN largo (o Cloudflare Access). El esquema se crea al arrancar.',
  'install.s3': 'Ponle HTTPS y ábrela en el móvil',
  'install.s3d': 'Con Cloudflare Tunnel, Caddy o Tailscale. Después, «Añadir a pantalla de inicio».',
  'install.guide': 'Guía de despliegue', 'install.readme': 'README',
  'oss.title': 'Código abierto, abierto a ideas',
  'oss.lead': '¿Has encontrado un fallo o tienes una idea? Issues y pull requests bienvenidos, en español o en inglés: traducciones, los pasillos de tu súper, funciones nuevas…',
  'oss.cta': 'Ver en GitHub',
  'coffee.title': 'Apoya el proyecto',
  'coffee.lead': 'Esta app es gratis y lo seguirá siendo. Si te resulta útil, puedes invitarme a un café para que siga adelante.',
  'coffee.cta': 'Invítame a un café',
  'footer.made': 'Hecho con cariño · Licencia MIT ·',
};

// The page is written in English; Spanish replaces the texts. The English originals are kept to switch back.
const demoUrl = () => 'demo/?lang=' + lang;
const EN = {};
let lang = 'en';

function apply(l) {
  lang = l;
  document.documentElement.lang = l;
  for (const el of document.querySelectorAll('[data-i18n],[data-i18n-html]')) {
    const html = el.hasAttribute('data-i18n-html');
    const key = el.getAttribute(html ? 'data-i18n-html' : 'data-i18n');
    if (!(key in EN)) EN[key] = html ? el.innerHTML : el.textContent;
    const text = l === 'es' ? ES[key] ?? EN[key] : EN[key];
    if (html) el.innerHTML = text; else el.textContent = text;
  }
  for (const el of document.querySelectorAll('[data-repo]')) {
    const path = (l === 'es' && el.getAttribute('data-repo-es')) || el.getAttribute('data-repo');
    el.href = REPO + path;
    el.target = '_blank';
    el.rel = 'noopener';
  }
  for (const el of document.querySelectorAll('[data-repo-text]')) el.textContent = REPO;
  document.getElementById('lang').textContent = l === 'es' ? 'EN' : 'ES';
  // Capturas y demo en el mismo idioma que la página
  for (const img of document.querySelectorAll('[data-shot]')) img.src = 'screenshots/' + l + '/' + img.dataset.shot;
  for (const a of document.querySelectorAll('a[href^="demo/"]')) a.href = demoUrl();
  const fr = document.getElementById('demo-frame');
  if (fr && fr.getAttribute('src')) fr.src = demoUrl();
  try { localStorage.setItem('grocery-site.lang', l); } catch (e) { /* private mode */ }
}

let saved = null;
try { saved = localStorage.getItem('grocery-site.lang'); } catch (e) { /* private mode */ }
apply(saved || ((navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en'));
document.getElementById('lang').addEventListener('click', () => apply(lang === 'es' ? 'en' : 'es'));

// Live demo: only loaded on wide screens (on phones, the buttons open it full screen) and when it scrolls into view
const frame = document.getElementById('demo-frame');
const wide = matchMedia('(min-width: 900px)');
function loadDemo() {
  if (!wide.matches || frame.src) return;
  frame.src = demoUrl();
  frame.closest('.phone').classList.add('live');
}
if ('IntersectionObserver' in window) {
  new IntersectionObserver((entries, obs) => {
    if (entries.some((e) => e.isIntersecting)) { loadDemo(); if (frame.src) obs.disconnect(); }
  }, { rootMargin: '200px' }).observe(frame);
} else loadDemo();
wide.addEventListener('change', loadDemo);
// On a phone, "Try the live demo" goes straight to the full-screen demo instead of scrolling to a cover
for (const a of document.querySelectorAll('[data-demo-cta]')) {
  a.addEventListener('click', (e) => { if (!wide.matches) { e.preventDefault(); location.href = demoUrl(); } });
}
