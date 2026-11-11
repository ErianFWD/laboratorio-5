const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema, example) => ({
  'application/json': { schema, ...(example === undefined ? {} : { example }) },
});
const errorResponse = (description, codigo, mensaje) => ({
  description,
  content: json(ref('Error'), { error: { codigo, mensaje } }),
});
const badRequest = errorResponse('Body inválido, JSON mal formado o mayor que 64 KB.',
  'VALIDACION_ERROR', 'El body no cumple el esquema.');
const notFound = errorResponse('La nota no existe.', 'NOTA_NO_ENCONTRADA', 'La nota no existe.');
const internalError = errorResponse('Error inesperado sin detalles internos.',
  'ERROR_INTERNO', 'Ocurrió un error interno.');
const aiMessage = 'El servicio de IA no está disponible. Intentá más tarde.';
const aiErrors = {
  429: errorResponse('Claude limitó las solicitudes. Intentá nuevamente más tarde.', 'IA_NO_DISPONIBLE', aiMessage),
  502: errorResponse('Error del proveedor, incluida clave inválida (401) o respuesta incompleta.', 'IA_NO_DISPONIBLE', aiMessage),
  503: errorResponse('Clave sin configurar, error de red, timeout o Claude no disponible.', 'IA_NO_DISPONIBLE', aiMessage),
};
const idParameter = {
  name: 'id', in: 'path', required: true,
  description: 'Identificador obtenido al crear la nota. Si no existe, responde 404.',
  schema: { type: 'string', example: 'ea7ff629-65e7-44a2-965d-65fc8c546672' },
};
const notaExample = {
  id: 'ea7ff629-65e7-44a2-965d-65fc8c546672',
  titulo: 'Repaso de Express',
  contenido: 'Express organiza rutas y middlewares. Zod valida la entrada. Claude genera resúmenes.',
};

const openapi = {
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
  paths: {
    '/api/notas': {
      get: {
        tags: ['Notas'], operationId: 'listarNotas', summary: 'Listar todas las notas',
        responses: {
          200: { description: 'Lista de notas; inicialmente está vacía.',
            content: json({ type: 'array', items: ref('Nota') }, [notaExample]) },
          500: internalError,
        },
      },
      post: {
        tags: ['Notas'], operationId: 'crearNota', summary: 'Crear una nota',
        description: 'Recorta espacios al inicio y final antes de validar. No admite campos adicionales.',
        requestBody: { required: true, content: json(ref('NuevaNota'), {
          titulo: notaExample.titulo, contenido: notaExample.contenido,
        }) },
        responses: {
          201: { description: 'Nota creada.',
            headers: { Location: { description: 'URL de la nota.', schema: { type: 'string' } } },
            content: json(ref('Nota'), notaExample) },
          400: badRequest, 500: internalError,
        },
      },
    },
    '/api/notas/{id}': {
      parameters: [idParameter],
      get: {
        tags: ['Notas'], operationId: 'obtenerNota', summary: 'Obtener una nota por ID',
        responses: {
          200: { description: 'Nota encontrada.', content: json(ref('Nota'), notaExample) },
          404: notFound, 500: internalError,
        },
      },
      delete: {
        tags: ['Notas'], operationId: 'eliminarNota', summary: 'Eliminar una nota',
        responses: {
          204: { description: 'Nota eliminada. Respuesta sin body.' },
          404: notFound, 500: internalError,
        },
      },
    },
    '/api/ia/preguntar': {
      post: {
        tags: ['IA'], operationId: 'preguntarClaude', summary: 'Hacer una pregunta libre a Claude',
        description: 'Valida y recorta la pregunta antes de llamar a Claude. Límite de salida: 512 tokens.',
        requestBody: { required: true, content: json(ref('Pregunta'), {
          pregunta: '¿Qué función cumple un middleware en Express?',
        }) },
        responses: {
          200: { description: 'Respuesta y consumo reportados por Claude. Los contadores no son estimaciones.',
            content: json(ref('RespuestaIA')) },
          400: badRequest, ...aiErrors, 500: internalError,
        },
      },
    },
    '/api/notas/{id}/resumen': {
      parameters: [idParameter],
      post: {
        tags: ['Notas', 'IA'], operationId: 'resumirNota', summary: 'Resumir una nota en tres viñetas breves en español',
        description: 'No requiere body. Busca la nota antes de llamar a Claude; un ID inexistente no consume tokens. '
          + 'No modifica la nota. Límite de salida: 256 tokens.',
        responses: {
          200: { description: 'Resumen y consumo reportados por Claude.', content: json(ref('ResumenIA')) },
          400: badRequest, 404: notFound, ...aiErrors, 500: internalError,
        },
      },
    },
  },
  components: {
    schemas: {
      NuevaNota: {
        type: 'object', additionalProperties: false, required: ['titulo', 'contenido'],
        properties: {
          titulo: { type: 'string', minLength: 1, maxLength: 100, example: notaExample.titulo },
          contenido: { type: 'string', minLength: 1, maxLength: 5000, example: notaExample.contenido },
        },
      },
      Nota: {
        type: 'object', additionalProperties: false, required: ['id', 'titulo', 'contenido'],
        properties: {
          id: { type: 'string', format: 'uuid', example: notaExample.id },
          titulo: { type: 'string', minLength: 1, maxLength: 100 },
          contenido: { type: 'string', minLength: 1, maxLength: 5000 },
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
        description: 'Contadores de Claude. Los valores reales están pendientes hasta ejecutar una consulta con clave válida.',
        properties: {
          input_tokens: { type: 'integer', minimum: 0, description: 'Tokens de entrada reportados por usage.input_tokens.' },
          output_tokens: { type: 'integer', minimum: 0, description: 'Tokens de salida reportados por usage.output_tokens.' },
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
        type: 'object', additionalProperties: false, required: ['resumen', 'uso'],
        properties: {
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
};

module.exports = { openapi };
