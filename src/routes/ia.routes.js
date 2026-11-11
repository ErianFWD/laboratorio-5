const { Router } = require('express');
const { validateBody } = require('../middlewares/validate-body');
const { preguntaSchema } = require('../utils/schemas');

function createIaRouter({ deepseekService }) {
  const router = Router();

  /**
   * @openapi
   * /api/ia/preguntar:
   *   post:
   *     tags: [IA]
   *     operationId: preguntarDeepSeek
   *     summary: Hacer una pregunta libre a DeepSeek
   *     description: Valida y recorta la pregunta antes de llamar a DeepSeek. Límite de salida de 512 tokens.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Pregunta'
   *     responses:
   *       '200':
   *         description: Respuesta y consumo reportados por DeepSeek; los contadores no son estimaciones.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RespuestaIA'
   *       '400':
   *         $ref: '#/components/responses/BodyInvalido'
   *       '429':
   *         $ref: '#/components/responses/IALimite'
   *       '502':
   *         $ref: '#/components/responses/IAError'
   *       '503':
   *         $ref: '#/components/responses/IANoDisponible'
   *       '500':
   *         $ref: '#/components/responses/ErrorInterno'
   */
  router.post('/preguntar', validateBody(preguntaSchema), async (req, res) => {
    res.json(await deepseekService.preguntar(req.body.pregunta));
  });

  return router;
}

module.exports = { createIaRouter };
