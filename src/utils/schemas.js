const { z } = require('zod');

const notaSchema = z.object({
  titulo: z.string().trim().min(1).max(100),
  contenido: z.string().trim().min(1).max(5000),
}).strict();

const preguntaSchema = z.object({
  pregunta: z.string().trim().min(3).max(2000),
}).strict();

module.exports = { notaSchema, preguntaSchema };
