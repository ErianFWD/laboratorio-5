const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const OpenAI = require('openai');
const { createApp } = require('../src/app');
const { createDeepSeekService } = require('../src/services/deepseek.service');

// Fixtures del proveedor: no son respuestas reales ni evidencia de consumo de tokens.
function fakeCompletion(content = 'Texto de prueba.') {
  return {
    id: 'chatcmpl_test', object: 'chat.completion', created: 1, model: 'deepseek-chat',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
  };
}

function sdkWithFetch(fetch) {
  return new OpenAI({
    apiKey: 'clave-de-prueba',
    baseURL: 'https://api.deepseek.com',
    maxRetries: 0,
    fetch,
  });
}

test('preguntar usa chat.completions.create con system y user y conserva el uso', async () => {
  let calls = 0;
  const client = sdkWithFetch(async (url, options) => {
    calls += 1;
    assert.equal(new URL(url).pathname, '/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'modelo-de-prueba');
    assert.equal(body.max_tokens, 512);
    assert.match(body.messages[0].content, /español/);
    assert.deepEqual(body.messages[1], { role: 'user', content: '¿Qué es Express?' });
    return Response.json(fakeCompletion('Respuesta de prueba.'));
  });
  const app = createApp({
    deepseekService: createDeepSeekService({ client, model: 'modelo-de-prueba' }),
  });
  const response = await request(app).post('/api/ia/preguntar')
    .send({ pregunta: '  ¿Qué es Express?  ' }).expect(200);
  assert.deepEqual(response.body, {
    respuesta: 'Respuesta de prueba.', uso: { input_tokens: 12, output_tokens: 7 },
  });
  assert.equal(calls, 1);
});

test('pregunta valida tipos, campos y límites antes de invocar DeepSeek', async () => {
  let calls = 0;
  const app = createApp({ deepseekService: {
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
    assert.match(body.messages[0].content, /tres viñetas breves en español/);
    assert.deepEqual(JSON.parse(body.messages[1].content), {
      titulo: 'Tema', contenido: 'Contenido.',
    });
    return Response.json(fakeCompletion('- Uno.\n- Dos.\n- Tres.'));
  });
  const app = createApp({ deepseekService: createDeepSeekService({ client }) });
  const missing = await request(app).post('/api/notas/999/resumen').expect(404);
  assert.equal(missing.body.error.codigo, 'NOTA_NO_ENCONTRADA');
  assert.equal(calls, 0);
  const nota = (await request(app).post('/api/notas')
    .send({ titulo: 'Tema', contenido: 'Contenido.' }).expect(201)).body;
  const response = await request(app).post(`/api/notas/${nota.id}/resumen`).expect(200);
  assert.deepEqual(response.body, {
    notaId: nota.id, resumen: '- Uno.\n- Dos.\n- Tres.',
    uso: { input_tokens: 12, output_tokens: 7 },
  });
  assert.equal(calls, 1);
  assert.deepEqual((await request(app).get(`/api/notas/${nota.id}`)).body, nota);
});

test('los errores HTTP del SDK se mapean sin filtrar detalles en ambos endpoints', async (t) => {
  for (const [upstream, expected] of [[400, 502], [401, 502], [402, 502], [403, 502],
    [404, 502], [429, 429], [500, 503], [503, 503]]) {
    await t.test(`DeepSeek ${upstream} → API ${expected}`, async () => {
      let calls = 0;
      const client = sdkWithFetch(async () => {
        calls += 1;
        return Response.json({ error: {
          message: 'detalle-interno-y-clave-de-prueba', type: 'api_error', code: 'privado',
        } }, { status: upstream, headers: { 'x-request-id': 'id-interno' } });
      });
      const app = createApp({ deepseekService: createDeepSeekService({ client }) });
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
  const app = createApp({ deepseekService: createDeepSeekService({ apiKey: '' }) });
  await request(app).post('/api/notas').send({ titulo: 'A', contenido: 'B' }).expect(201);
  const response = await request(app).post('/api/ia/preguntar')
    .send({ pregunta: 'Hola' }).expect(502);
  assert.equal(response.body.error.codigo, 'IA_NO_DISPONIBLE');
  await request(app).post('/api/notas/999/resumen').expect(404);
});

test('conexión y timeout devuelven 503, y una respuesta incompleta devuelve 502', async () => {
  for (const client of [
    sdkWithFetch(async () => { throw new Error('detalle de red privado'); }),
    { chat: { completions: { create: async () => { throw new OpenAI.APIConnectionTimeoutError(); } } } },
  ]) {
    const app = createApp({ deepseekService: createDeepSeekService({ client }) });
    const response = await request(app).post('/api/ia/preguntar')
      .send({ pregunta: 'Hola' }).expect(503);
    assert.equal(response.body.error.codigo, 'IA_NO_DISPONIBLE');
  }
  for (const payload of [fakeCompletion(''), { ...fakeCompletion(), usage: {} }]) {
    const client = sdkWithFetch(async () => Response.json(payload));
    const app = createApp({ deepseekService: createDeepSeekService({ client }) });
    const response = await request(app).post('/api/ia/preguntar')
      .send({ pregunta: 'Hola' }).expect(502);
    assert.equal(response.body.error.codigo, 'IA_NO_DISPONIBLE');
  }
});
