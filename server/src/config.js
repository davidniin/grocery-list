// Configuración desde variables de entorno (server/.env en local, env del contenedor en Docker).
// Ver server/.env.example y deploy/.env.example.
const env = process.env;

const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

export const CONFIG = {
  port: +(env.PORT || 8790),
  databaseUrl: env.DATABASE_URL || 'postgres://grocery:grocery@localhost:5432/grocery',
  // Carpeta con la web compilada (web/dist). Vacío = solo API.
  staticDir: env.STATIC_DIR || '',

  // ---- Acceso. Vale cualquiera de los dos; sin ninguno el servidor no arranca (salvo ALLOW_NO_AUTH=1).
  // 1. Clave compartida: cabecera "Authorization: Bearer <GROCERY_TOKEN>" (móvil, dashboard, scripts).
  token: env.GROCERY_TOKEN || '',
  // 2. Cloudflare Access: se comprueba la firma del JWT que Cloudflare añade a cada petición
  //    (cabecera Cf-Access-Jwt-Assertion). Si alguien se salta Access, no entra.
  cfAccess: env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD
    ? { teamDomain: env.CF_ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/+$/, ''), aud: list(env.CF_ACCESS_AUD) }
    : null,
  // Solo para desarrollo en local: sin ninguna comprobación de acceso.
  allowNoAuth: env.ALLOW_NO_AUTH === '1',

  // Orígenes a los que se permite llamar a la API desde otro dominio (CORS). Vacío = ninguno (lo normal:
  // la web va en el mismo dominio y el dashboard llama desde su servidor, sin navegador).
  corsOrigins: list(env.CORS_ORIGINS),
};

// Comprueba que la configuración de acceso tiene sentido. Devuelve la lista de errores (vacía = bien).
export function configErrors(c = CONFIG) {
  const errors = [];
  if (c.token && c.token.length < 24) errors.push('GROCERY_TOKEN es demasiado corto (mínimo 24 caracteres: openssl rand -hex 24)');
  if (!c.token && !c.cfAccess && !c.allowNoAuth) {
    errors.push('no hay control de acceso: pon GROCERY_TOKEN y/o CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD (o ALLOW_NO_AUTH=1 solo en local)');
  }
  return errors;
}
