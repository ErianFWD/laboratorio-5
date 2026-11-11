const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const Anthropic = require('@anthropic-ai/sdk');
const { createApp } = require('../src/app');
const { createClaudeService } = require('../src/services/claude.service');

// Fixtures del proveedor: no son respuestas reales ni evidencia de consumo de tokens.
function fakeMessage(content = [{ type: 'text', text: 'Texto de prueba.' }]) {
  return {
    id: 'msg_test', type: 'message', role: 'assistant', model: 'modelo-de-prueba',
    content, stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 12, output_tokens: 7 },
  };
}

function sdkWithFetch(fetch) {
  return new Anthropic({ apiKey: 'clave-de-prueba', maxRetries: 0, fetch });
}

test('preguntar usa messages.create, separa system y messages y conserva el uso', async () => {
  let calls = 0;
  const client = sdkWithFetch(async (url, options) => {
    calls += 1;
    assert.equal(new URL(url).pathname, '/v1/messages');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'modelo-de-prueba');
    assert.equal(body.max_tokens, 512);
    assert.match(body.system, /español/);
    assert.deepEqual(body.messages, [{ role: 'user', content: '¿Qué es Express?' }]);
    return Response.json(fakeMessage([
      { type: 'text', text: 'Primer bloque.' },
      { type: 'thinking', thinking: 'No debe exponerse.', signature: 'test' },
      { type: 'text', text: 'Segundo bloque.' },
    ]));
  });
  const app = createApp({ claudeService: createClaudeService({ client, model: 'modelo-de-prueba' }) });
  const response = await request(app).post('/api/ia/preguntar')
    .send({ pregunta: '  ¿Qué es Express?  ' }).expect(200);
  assert.deepEqual(response.body, {
    respuesta: 'Primer bloque.\nSegundo bloque.', uso: { input_tokens: 12, output_tokens: 7 },
  });
  assert.equal(calls, 1);
});

test('pregunta valida tipos, campos y límites antes de invocar Claude', async () => {
  let calls = 0;
  const app = createApp({ claudeService: {
    preguntar: async () => { calls += 1; return { respuesta: 'Prueba', uso: {} }; },
  } });
  for (const body of [{}, { pregunta: 'ab' }, { pregunta: '   ' }, { pregunta: 123 },
    { pregunta: 'a'.repeat(2001) }, { pregunta: 'Hola', otro: true }, [], null]) {
    const response = await request(app).post('/api/ia/preguntar').send(body).expect(400);
    assert.equal(response.body.error.codigo, 'VALIDACION_ERROR');
  }
  await request(app).post('/api/ia/preguntar').expect(400);
  assert.equal(calls, 0);
  for (const pregunta of ['abc', 'a'.repeat(2000)]) {
    await request(app).post('/api/ia/preguntar').send({ pregunta }).expect(200);
  }
  assert.equal(calls, 2);
});

test('resumen busca la nota primero y pide tres viñetas breves en español', async () => {
  let calls = 0;
  const client = sdkWithFetch(async (url, options) => {
    calls += 1;
    const body = JSON.parse(options.body);
    assert.equal(body.max_tokens, 256);
    assert.match(body.system, /tres viñetas breves en español/);
    assert.deepEqual(JSON.parse(body.messages[0].content), { titulo: 'Tema', contenido: 'Contenido.' });
    return Response.json(fakeMessage([{ type: 'text', text: '- Uno.\n- Dos.\n- Tres.' }]));
  });
  const app = createApp({ claudeService: createClaudeService({ client }) });
  const missing = await request(app).post('/api/notas/inexistente/resumen').expect(404);
  assert.equal(missing.body.error.codigo, 'NOTA_NO_ENCONTRADA');
  assert.equal(calls, 0);
  const nota = (await request(app).post('/api/notas')
    .send({ titulo: 'Tema', contenido: 'Contenido.' }).expect(201)).body;
  const response = await request(app).post(`/api/notas/${nota.id}/resumen`).expect(200);
  assert.deepEqual(response.body, {
    notaId: nota.id, resumen: '- Uno.\n- Dos.\n- Tres.', uso: { input_tokens: 12, output_tokens: 7 },
  });
  assert.equal(calls, 1);
  assert.deepEqual((await request(app).get(`/api/notas/${nota.id}`)).body, nota);
});

test('los errores HTTP del SDK se mapean sin filtrar detalles en ambos endpoints', async (t) => {
  for (const [upstream, expected] of [[401, 502], [403, 502], [400, 502], [404, 502],
    [429, 429], [408, 502], [500, 502], [503, 502], [529, 503]]) {
    await t.test(`Claude ${upstream} → API ${expected}`, async () => {
      let calls = 0;
      const client = sdkWithFetch(async () => {
        calls += 1;
        return Response.json({ type: 'error', error: {
          type: 'api_error', message: 'detalle-interno-y-clave-de-prueba',
        } }, { status: upstream, headers: { 'request-id': 'id-interno' } });
      });
      const app = createApp({ claudeService: createClaudeService({ client }) });
      const nota = (await request(app).post('/api/notas')
        .send({ titulo: 'A', contenido: 'B' })).body;
      for (const [path, body] of [
        ['/api/ia/preguntar', { pregunta: 'Pregunta válida' }],
        [`/api/notas/${nota.id}/resumen`, undefined],
      ]) {
        const response = await request(app).post(path).send(body).expect(expected);
        assert.deepEqual(response.body, { error: {
          codigo: 'IA_NO_DISPONIBLE',
          mensaje: 'El servicio de IA no está disponible. Intentá más tarde.',
        } });
        assert.doesNotMatch(response.text, /detalle-interno|clave-de-prueba|id-interno|stack/);
      }
      assert.equal(calls, 2, 'no debe haber reintentos automáticos');
    });
  }
});

test('la falta de clave permite notas y devuelve 502 en IA; la nota ausente conserva 404', async () => {
  const app = createApp({ claudeService: createClaudeService({ apiKey: '' }) });
  await request(app).post('/api/notas').send({ titulo: 'A', contenido: 'B' }).expect(201);
  const response = await request(app).post('/api/ia/preguntar').send({ pregunta: 'Hola' }).expect(502);
  assert.equal(response.body.error.codigo, 'IA_NO_DISPONIBLE');
  await request(app).post('/api/notas/no-existe/resumen').expect(404);
});

test('conexión y timeout devuelven 503, y una respuesta vacía devuelve 502', async () => {
  for (const client of [
    sdkWithFetch(async () => { throw new Error('detalle de red privado'); }),
    { messages: { create: async () => { throw new Anthropic.APIConnectionTimeoutError(); } } },
  ]) {
    const app = createApp({ claudeService: createClaudeService({ client }) });
    const response = await request(app).post('/api/ia/preguntar').send({ pregunta: 'Hola' }).expect(503);
    assert.equal(response.body.error.codigo, 'IA_NO_DISPONIBLE');
  }
  for (const payload of [fakeMessage([]), { ...fakeMessage(), usage: {} }]) {
    const client = sdkWithFetch(async () => Response.json(payload));
    const app = createApp({ claudeService: createClaudeService({ client }) });
    const response = await request(app).post('/api/ia/preguntar').send({ pregunta: 'Hola' }).expect(502);
    assert.equal(response.body.error.codigo, 'IA_NO_DISPONIBLE');
  }
});
