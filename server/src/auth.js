// Control de acceso a /v1. Entra quien traiga cualquiera de las dos credenciales configuradas:
//  - Authorization: Bearer <GROCERY_TOKEN>
//  - un JWT de Cloudflare Access válido (cabecera Cf-Access-Jwt-Assertion, la pone Cloudflare)
import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { CONFIG } from './config.js';

const PUBLIC = new Set(['/v1/health']);

function sameSecret(a, b) {
  // Se comparan los hash: así el tiempo no depende ni del contenido ni de la longitud
  const x = crypto.createHash('sha256').update(a).digest(), y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

// keys: solo para los tests (un JWKS local en lugar de descargar las claves de Cloudflare)
export function accessCheck(config = CONFIG, { keys } = {}) {
  const { token, cfAccess, allowNoAuth } = config;
  let verifyCf = null;
  if (cfAccess) {
    const issuer = 'https://' + cfAccess.teamDomain;
    const jwks = keys || createRemoteJWKSet(new URL(issuer + '/cdn-cgi/access/certs'));
    verifyCf = (jwt) => jwtVerify(jwt, jwks, { issuer, audience: cfAccess.aud, algorithms: ['RS256'] });
  }

  return async (c, next) => {
    if (PUBLIC.has(c.req.path) || c.req.method === 'OPTIONS') return next();
    if (!token && !verifyCf && allowNoAuth) return next();

    const h = c.req.header('authorization') || '';
    if (token && h.startsWith('Bearer ') && sameSecret(h.slice(7), token)) return next();

    const jwt = c.req.header('cf-access-jwt-assertion');
    if (verifyCf && jwt) {
      try {
        await verifyCf(jwt);
        return next();
      } catch (e) {
        console.warn('[auth] JWT de Cloudflare Access no válido: ' + e.code);
      }
    }
    return c.json({ error: 'no autorizado' }, 401);
  };
}
