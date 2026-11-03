// Tests sin base de datos: validación, configuración y control de acceso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose';
import { clean, cleanId, cleanStore, money, imageType, LIMITS } from '../src/validate.js';
import { configErrors } from '../src/config.js';
import { accessCheck } from '../src/auth.js';

test('clean: valores por defecto, recortes y tipos', () => {
  const it = clean({ id: 'a1', name: '  Leche  ', qty: '3.6', done: 1, extra: 'x' });
  assert.deepEqual(it, { id: 'a1', name: 'Leche', cat: 'Otros', qty: 4, store: null, done: true, note: '' });
  assert.equal(clean({ name: 'x'.repeat(500) }).name.length, LIMITS.name);
  assert.equal(clean({ name: 'a', cat: 'c'.repeat(500) }).cat.length, LIMITS.cat);
  assert.equal(clean({ name: 'a', qty: 5000 }).qty, 999);
  assert.equal(clean({ name: 'a', qty: -2 }).qty, 1);
  assert.match(clean({ name: 'a' }).id, /^i/);
  assert.equal(clean({ name: 'a', id: 'x'.repeat(200) }).id.length, LIMITS.id);
});

test('clean parcial: solo los campos que vienen', () => {
  assert.deepEqual(clean({ done: true }, true), { done: true });
  assert.deepEqual(clean(null, true), {});
});

test('tiendas: solo las conocidas', () => {
  assert.equal(cleanStore('bonpreu'), 'bonpreu');
  assert.equal(cleanStore('otra'), null);
  assert.equal(cleanStore(''), null);
  assert.equal(clean({ name: 'a', store: '<script>' }).store, null);
  assert.equal(cleanId('  ab  '), 'ab');
});

test('money: euros con coma o punto', () => {
  assert.equal(money('12,345'), 12.35);
  assert.equal(money(7), 7);
  assert.equal(money(''), null);
  assert.equal(money(null), null);
  assert.equal(money(-1), null);
  assert.equal(money('abc'), null);
  assert.equal(money(2e6), null);
});

test('imageType: por los bytes, no por el nombre', () => {
  assert.equal(imageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg');
  assert.equal(imageType(Buffer.from('89504e470d0a1a0a0000', 'hex')), 'image/png');
  assert.equal(imageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')), 'image/webp');
  assert.equal(imageType(Buffer.from('\0\0\0\x18ftypheic\0\0\0\0', 'latin1')), 'image/heic');
  assert.equal(imageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')), null);
  assert.equal(imageType(Buffer.from('<html>')), null);
  assert.equal(imageType(Buffer.alloc(0)), null);
});

test('config: sin control de acceso no arranca', () => {
  assert.equal(configErrors({ token: '', cfAccess: null, allowNoAuth: false }).length, 1);
  assert.equal(configErrors({ token: 'corto', cfAccess: null, allowNoAuth: false }).length, 1);
  assert.deepEqual(configErrors({ token: 'x'.repeat(24), cfAccess: null, allowNoAuth: false }), []);
  assert.deepEqual(configErrors({ token: '', cfAccess: { teamDomain: 't', aud: ['a'] }, allowNoAuth: false }), []);
  assert.deepEqual(configErrors({ token: '', cfAccess: null, allowNoAuth: true }), []);
});

// ------------------------------------------------------------ control de acceso
const TOKEN = 'x'.repeat(32);
const TEAM = 'casa.cloudflareaccess.com', AUD = 'aud-123';
const { privateKey, publicKey } = await generateKeyPair('RS256');
const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }] });
const now = Math.floor(Date.now() / 1000);
const jwt = (claims = {}, key = privateKey) =>
  new SignJWT({ email: 'a@b.c', iss: 'https://' + TEAM, aud: AUD, iat: now, exp: now + 300, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' }).sign(key);

function appWith(config) {
  const app = new Hono();
  app.use('*', accessCheck({ cfAccess: null, allowNoAuth: false, token: '', ...config }, { keys }));
  app.get('/v1/health', (c) => c.text('ok'));
  app.get('/v1/list', (c) => c.text('ok'));
  return app;
}
const status = async (app, headers = {}, path = '/v1/list') => (await app.request(path, { headers })).status;

test('acceso con token', async () => {
  const app = appWith({ token: TOKEN });
  assert.equal(await status(app), 401);
  assert.equal(await status(app, { Authorization: 'Bearer nope' }), 401);
  assert.equal(await status(app, { Authorization: 'Bearer ' + TOKEN }), 200);
  assert.equal(await status(app, {}, '/v1/health'), 200);
  assert.equal(await status(app, {}, '/v1/list?token=' + TOKEN), 401, 'el token ya no vale en la URL');
});

test('acceso con Cloudflare Access', async () => {
  const app = appWith({ cfAccess: { teamDomain: TEAM, aud: [AUD] } });
  assert.equal(await status(app), 401);
  assert.equal(await status(app, { 'Cf-Access-Jwt-Assertion': await jwt() }), 200);
  assert.equal(await status(app, { 'Cf-Access-Jwt-Assertion': await jwt({ aud: 'otra' }) }), 401);
  assert.equal(await status(app, { 'Cf-Access-Jwt-Assertion': await jwt({ exp: 1000 }) }), 401);
  const other = (await generateKeyPair('RS256')).privateKey;
  assert.equal(await status(app, { 'Cf-Access-Jwt-Assertion': await jwt({}, other) }), 401, 'firma de otra clave');
  assert.equal(await status(app, { 'Cf-Access-Jwt-Assertion': 'basura' }), 401);
});

test('sin nada configurado y ALLOW_NO_AUTH: abierto', async () => {
  assert.equal(await status(appWith({ allowNoAuth: true })), 200);
});
