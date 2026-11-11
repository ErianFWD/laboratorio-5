const { z } = require('zod');

const envSchema = z.object({
  DEEPSEEK_API_KEY: z.string().trim().default(''),
  DEEPSEEK_MODEL: z.string().trim().min(1).default('deepseek-chat'),
  DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

function readConfig(env = process.env) {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // No incluir los valores de las variables en errores de arranque.
    throw new Error('Configuración inválida: revisá PORT, DEEPSEEK_MODEL y DEEPSEEK_BASE_URL.');
  }

  return {
    apiKey: result.data.DEEPSEEK_API_KEY,
    model: result.data.DEEPSEEK_MODEL,
    baseURL: result.data.DEEPSEEK_BASE_URL,
    port: result.data.PORT,
  };
}

const config = readConfig();

module.exports = { config, readConfig };
