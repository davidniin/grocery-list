// Los dos idiomas tienen las mismas claves y los mismos {huecos}. Se ejecuta con: node --test web/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import es from '../src/i18n/es.js';
import en from '../src/i18n/en.js';

const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('es and en have the same keys', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
});

test('same placeholders and plural forms in both languages', () => {
  for (const k of Object.keys(es)) {
    assert.equal(holes(en[k]), holes(es[k]), 'placeholders of ' + k);
    assert.equal(en[k].includes('|'), es[k].includes('|'), 'plural form of ' + k);
  }
});
