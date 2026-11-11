const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');

test('ciclo de notas: 200, 201, 204 y 404 con persistencia durante el proceso', async () => {
  const app = createApp();
  assert.deepEqual((await request(app).get('/api/notas').expect(200)).body, []);
  const created = await request(app).post('/api/notas')
    .send({ titulo: '  Laboratorio 5  ', contenido: '  Notas con Express.  ' }).expect(201);
  const nota = created.body;
  assert.match(nota.id, /^[0-9a-f-]{36}$/);
  assert.equal(nota.titulo, 'Laboratorio 5');
  assert.equal(nota.contenido, 'Notas con Express.');
  assert.equal(created.headers.location, `/api/notas/${nota.id}`);
  assert.deepEqual((await request(app).get(`/api/notas/${nota.id}`).expect(200)).body, nota);
  assert.deepEqual((await request(app).get('/api/notas').expect(200)).body, [nota]);
  const deleted = await request(app).delete(`/api/notas/${nota.id}`).expect(204);
  assert.equal(deleted.text, '');
  await request(app).get(`/api/notas/${nota.id}`).expect(404);
  await request(app).delete(`/api/notas/${nota.id}`).expect(404);
  assert.deepEqual((await request(app).get('/api/notas').expect(200)).body, []);
});

test('acepta los límites exactos de título y contenido', async () => {
  const app = createApp();
  for (const [titulo, contenido] of [['a', 'b'], ['a'.repeat(100), 'b'.repeat(5000)]]) {
    await request(app).post('/api/notas').send({ titulo, contenido }).expect(201);
  }
});

test('rechaza campos ausentes, tipos incorrectos, espacios y límites excedidos con 400', async () => {
  const app = createApp();
  const invalid = [
    {}, { titulo: 'Hola' }, { contenido: 'Texto' },
    { titulo: '', contenido: 'Texto' }, { titulo: '   ', contenido: 'Texto' },
    { titulo: 'a'.repeat(101), contenido: 'Texto' },
    { titulo: 'Hola', contenido: '' }, { titulo: 'Hola', contenido: '  ' },
    { titulo: 'Hola', contenido: 'b'.repeat(5001) },
    { titulo: 1, contenido: 'Texto' }, { titulo: 'Hola', contenido: null },
    { titulo: 'Hola', contenido: 'Texto', id: 'id-del-cliente' },
    [], null,
  ];
  for (const body of invalid) {
    const response = await request(app).post('/api/notas').send(body).expect(400);
    assert.equal(response.body.error.codigo, 'VALIDACION_ERROR');
  }
  await request(app).post('/api/notas').expect(400);
  await request(app).post('/api/notas').type('text').send('texto').expect(400);
  assert.deepEqual((await request(app).get('/api/notas')).body, []);
});

test('una nota inexistente responde 404 y las instancias no comparten memoria', async () => {
  const app = createApp();
  const nota = (await request(app).post('/api/notas').send({ titulo: 'A', contenido: 'B' })).body;
  const other = createApp();
  const response = await request(other).get(`/api/notas/${nota.id}`).expect(404);
  assert.equal(response.body.error.codigo, 'NOTA_NO_ENCONTRADA');
});

test('un body demasiado grande devuelve 400 sin almacenarse', async () => {
  const app = createApp();
  const response = await request(app).post('/api/notas')
    .send({ titulo: 'A', contenido: 'b'.repeat(70000) }).expect(400);
  assert.equal(response.body.error.codigo, 'BODY_INVALIDO');
  assert.deepEqual((await request(app).get('/api/notas')).body, []);
});
