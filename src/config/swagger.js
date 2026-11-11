const path = require('node:path');
const swaggerJsdoc = require('swagger-jsdoc');

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const errorResponse = (description, codigo, mensaje) => ({
  description,
  content: { 'application/json': { schema: ref('Error'), example: { error: { codigo, mensaje } } } },
});
const aiMessage = 'El servicio de IA no está disponible. Intentá más tarde.';

const openapi = swaggerJsdoc({
  failOnErrors: true,
  // Ruta absoluta para generar la documentación independientemente del cwd.
  apis: [path.join(__dirname, '../routes/*.routes.js').replace(/\\/g, '/')],
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Laboratorio #5: notas e IA', version: '1.0.0',
      description: 'API de notas en memoria con Claude desde el backend. '
        + 'Documentación interactiva: /api-docs. Los ejemplos son ilustrativos, no resultados reales de Claude. '
        + 'La clave se configura únicamente en el servidor; no se ingresa en Swagger.',
    },
    servers: [{ url: '/', description: 'Servidor actual (PORT configurable)' }],
    tags: [
      { name: 'Notas', description: 'Las notas se pierden al reiniciar el servidor.' },
      { name: 'IA', description: 'Consultas a Claude; requieren una clave válida en el backend.' },
    ],
    components: {
      parameters: {
        NotaId: { name: 'id', in: 'path', required: true,
          description: 'ID obtenido al crear la nota. Si no existe, responde 404.',
          schema: { type: 'integer', minimum: 1, example: 1 } },
      },
      responses: {
        BodyInvalido: errorResponse('Body inválido, JSON mal formado o mayor que 64 KB.',
          'VALIDACION_ERROR', 'El body no cumple el esquema.'),
        NotaNoEncontrada: errorResponse('La nota no existe.', 'NOTA_NO_ENCONTRADA', 'La nota no existe.'),
        ErrorInterno: errorResponse('Error inesperado sin detalles internos.', 'ERROR_INTERNO', 'Ocurrió un error interno.'),
        IALimite: errorResponse('Claude limitó las solicitudes (429). Reintentá más tarde.', 'IA_NO_DISPONIBLE', aiMessage),
        IAError: errorResponse('Clave ausente, error HTTP distinto de 429/529 o respuesta incompleta.', 'IA_NO_DISPONIBLE', aiMessage),
        IANoDisponible: errorResponse('Claude saturado (529), error de conexión o timeout de red.', 'IA_NO_DISPONIBLE', aiMessage),
      },
      schemas: {
        NuevaNota: {
          type: 'object', additionalProperties: false, required: ['titulo', 'contenido'],
          properties: {
            titulo: { type: 'string', minLength: 1, maxLength: 100, example: 'Repaso de Express' },
            contenido: { type: 'string', minLength: 1, maxLength: 5000,
              example: 'Express organiza rutas y middlewares. Zod valida la entrada. Claude genera resúmenes.' },
          },
        },
        Nota: {
          type: 'object', additionalProperties: false, required: ['id', 'titulo', 'contenido'],
          properties: {
            id: { type: 'integer', minimum: 1, example: 1 },
            titulo: { type: 'string', minLength: 1, maxLength: 100, example: 'Repaso de Express' },
            contenido: { type: 'string', minLength: 1, maxLength: 5000, example: 'Express organiza rutas y middlewares.' },
          },
        },
        Pregunta: {
          type: 'object', additionalProperties: false, required: ['pregunta'],
          properties: { pregunta: { type: 'string', minLength: 3, maxLength: 2000,
            description: 'Se recortan los espacios iniciales y finales.',
            example: '¿Qué función cumple un middleware en Express?' } },
        },
        Uso: {
          type: 'object', additionalProperties: false, required: ['input_tokens', 'output_tokens'],
          description: 'Contadores reales de Claude; pendientes hasta ejecutar una consulta con clave válida.',
          properties: {
            input_tokens: { type: 'integer', minimum: 0, description: 'Tokens reportados por usage.input_tokens.' },
            output_tokens: { type: 'integer', minimum: 0, description: 'Tokens reportados por usage.output_tokens.' },
          },
        },
        RespuestaIA: {
          type: 'object', additionalProperties: false, required: ['respuesta', 'uso'],
          properties: {
            respuesta: { type: 'string', minLength: 1, example: 'Texto ilustrativo: un middleware procesa la solicitud.' },
            uso: ref('Uso'),
          },
        },
        ResumenIA: {
          type: 'object', additionalProperties: false, required: ['notaId', 'resumen', 'uso'],
          properties: {
            notaId: { type: 'integer', minimum: 1, example: 1 },
            resumen: { type: 'string', minLength: 1,
              example: '- Ejemplo ilustrativo de una idea.\n- Segunda idea de ejemplo.\n- Tercera idea de ejemplo.' },
            uso: ref('Uso'),
          },
        },
        Error: {
          type: 'object', additionalProperties: false, required: ['error'],
          properties: {
            error: { type: 'object', additionalProperties: false, required: ['codigo', 'mensaje'],
              properties: {
                codigo: { type: 'string', example: 'IA_NO_DISPONIBLE' },
                mensaje: { type: 'string', example: aiMessage },
                detalles: { type: 'array', items: {
                  type: 'object', required: ['campo', 'mensaje'], properties: {
                    campo: { type: 'string' }, mensaje: { type: 'string' },
                  },
                } },
              },
            },
          },
        },
      },
    },
  },
});

module.exports = { openapi };
