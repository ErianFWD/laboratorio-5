const { z } = require('zod');

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().trim().default(''),
  CLAUDE_MODEL: z.string().trim().min(1).default('claude-haiku-4-5-20251001'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

function readConfig(env = process.env) {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // No incluir los valores de las variables en errores de arranque.
    throw new Error('Configuración inválida: revisá PORT y CLAUDE_MODEL.');
  }

  return {
    apiKey: result.data.ANTHROPIC_API_KEY,
    model: result.data.CLAUDE_MODEL,
    port: result.data.PORT,
  };
}

const config = readConfig();

module.exports = { config, readConfig };
