const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');

test('las rutas inexistentes devuelven un error JSON 404', async () => {
  const response = await request(createApp()).get('/inexistente').expect(404);
  assert.equal(response.body.error.codigo, 'NO_ENCONTRADO');
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('la raíz sirve la consola visual del laboratorio', async () => {
  const response = await request(createApp()).get('/').expect(200).expect('Content-Type', /html/);
  assert.match(response.text, /API Playground/);
  assert.match(response.text, /Laboratorio #5/);
  assert.doesNotMatch(response.text, /DEEPSEEK_API_KEY/);
});

test('el JSON mal formado devuelve 400 sin stack ni body original', async () => {
  const response = await request(createApp())
    .post('/api/notas')
    .set('Content-Type', 'application/json')
    .send('{"titulo":')
    .expect(400);
  assert.deepEqual(response.body, {
    error: { codigo: 'JSON_INVALIDO', mensaje: 'El body debe ser JSON válido.' },
  });
});
