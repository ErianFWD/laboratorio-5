const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readConfig } = require('../src/config/env');

test('la configuración permite iniciar sin clave y usa los valores del laboratorio', () => {
  assert.deepEqual(readConfig({}), {
    apiKey: '',
    model: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com',
    port: 3000,
  });
});

test('rechaza puertos inválidos sin revelar secretos', () => {
  for (const port of ['', 'abc', '0', '-1', '65536', '3000.5']) {
    assert.throws(() => readConfig({ PORT: port, DEEPSEEK_API_KEY: 'secreto-de-prueba' }), {
      message: 'Configuración inválida: revisá PORT, DEEPSEEK_MODEL y DEEPSEEK_BASE_URL.',
    });
  }
});

test('rechaza una URL base inválida sin revelar la clave', () => {
  assert.throws(() => readConfig({
    DEEPSEEK_API_KEY: 'secreto-de-prueba',
    DEEPSEEK_BASE_URL: 'no-es-una-url',
  }), {
    message: 'Configuración inválida: revisá PORT, DEEPSEEK_MODEL y DEEPSEEK_BASE_URL.',
  });
});
