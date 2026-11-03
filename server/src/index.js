// Arranque: comprueba la configuración, aplica las migraciones y sirve la app. Ver README.md.
import { serve } from '@hono/node-server';
import { CONFIG, configErrors } from './config.js';
import { sql, migrate } from './db.js';
import { createApp } from './app.js';

const errors = configErrors();
if (errors.length) {
  for (const e of errors) console.error('[config] ' + e);
  process.exit(1);
}

await migrate();
const server = serve({ fetch: createApp().fetch, port: CONFIG.port }, () => {
  const access = [CONFIG.token && 'token', CONFIG.cfAccess && 'Cloudflare Access'].filter(Boolean).join(' + ') || 'NINGUNO (ALLOW_NO_AUTH)';
  console.log('grocery en :' + CONFIG.port + ' · acceso: ' + access + ' · web: ' + (CONFIG.staticDir || 'no'));
});

// docker stop manda SIGTERM: se terminan las peticiones en curso y se cierra la base de datos
function shutdown(signal) {
  console.log('[server] ' + signal + ', cerrando');
  server.close(() => sql.end({ timeout: 5 }).finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
