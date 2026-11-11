const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const SwaggerParser = require('@apidevtools/swagger-parser');
const { openapi } = require('../src/config/openapi');
const { createApp } = require('../src/app');

test('OpenAPI 3 es válido y documenta las seis operaciones con sus estados', async () => {
  await SwaggerParser.validate(structuredClone(openapi));
  const expected = {
    'get /api/notas': [200],
    'post /api/notas': [201, 400],
    'get /api/notas/{id}': [200, 404],
    'delete /api/notas/{id}': [204, 404],
    'post /api/ia/preguntar': [200, 400, 429, 502, 503],
    'post /api/notas/{id}/resumen': [200, 404, 429, 502, 503],
  };
  const operations = Object.entries(openapi.paths).flatMap(([path, item]) =>
    Object.keys(item).filter((method) => ['get', 'post', 'delete'].includes(method))
      .map((method) => `${method} ${path}`));
  assert.deepEqual(operations.sort(), Object.keys(expected).sort());
  for (const [operation, statuses] of Object.entries(expected)) {
    const [method, path] = operation.split(' ');
    for (const status of statuses) assert.ok(openapi.paths[path][method].responses[status]);
  }
  assert.equal(openapi.paths['/api/notas/{id}'].delete.responses[204].content, undefined);
});

test('la raíz enlaza /api-docs y Swagger sirve HTML, assets y el contrato JSON', async () => {
  const app = createApp();
  assert.deepEqual((await request(app).get('/').expect(200)).body, { documentacion: '/api-docs' });
  const redirect = await request(app).get('/api-docs').expect(301);
  assert.equal(redirect.headers.location, '/api-docs/');
  const response = await request(app).get('/api-docs/').expect(200).expect('Content-Type', /html/);
  assert.match(response.text, /swagger-ui/);
  await request(app).get('/api-docs/swagger-ui.css').expect(200).expect('Content-Type', /css/);
  const setup = await request(app).get('/api-docs/swagger-ui-init.js').expect(200);
  assert.match(setup.text, /preguntarClaude/);
  assert.doesNotMatch(setup.text, /ANTHROPIC_API_KEY/);
  const schema = await request(app).get('/api-docs/openapi.json').expect(200);
  assert.deepEqual(schema.body, openapi);
});
