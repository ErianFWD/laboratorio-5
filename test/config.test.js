const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readConfig } = require('../src/config/env');

test('la configuración permite iniciar sin clave y usa los valores del laboratorio', () => {
  assert.deepEqual(readConfig({}), {
    apiKey: '',
    model: 'claude-haiku-4-5-20251001',
    port: 3000,
  });
});

test('rechaza puertos inválidos sin revelar secretos', () => {
  for (const port of ['', 'abc', '0', '-1', '65536', '3000.5']) {
    assert.throws(() => readConfig({ PORT: port, ANTHROPIC_API_KEY: 'secreto-de-prueba' }), {
      message: 'Configuración inválida: revisá PORT y CLAUDE_MODEL.',
    });
  }
});
