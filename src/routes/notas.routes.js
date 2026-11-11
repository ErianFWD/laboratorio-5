const { Router } = require('express');
const { validateBody } = require('../middlewares/validate-body');
const { notaSchema } = require('../utils/schemas');

function createNotasRouter({ notasService, deepseekService }) {
  const router = Router();

  /**
   * @openapi
   * /api/notas:
   *   get:
   *     tags: [Notas]
   *     operationId: listarNotas
   *     summary: Listar todas las notas
   *     responses:
   *       '200':
   *         description: Lista de notas; inicialmente está vacía.
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Nota'
   *             example: []
   *       '500':
   *         $ref: '#/components/responses/ErrorInterno'
   */
  router.get('/', (req, res) => {
    res.json(notasService.listar());
  });

  /**
   * @openapi
   * /api/notas/{id}:
   *   get:
   *     tags: [Notas]
   *     operationId: obtenerNota
   *     summary: Obtener una nota por ID
   *     parameters:
   *       - $ref: '#/components/parameters/NotaId'
   *     responses:
   *       '200':
   *         description: Nota encontrada.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Nota'
   *       '404':
   *         $ref: '#/components/responses/NotaNoEncontrada'
   *       '500':
   *         $ref: '#/components/responses/ErrorInterno'
   */
  router.get('/:id', (req, res) => {
    res.json(notasService.obtener(Number(req.params.id)));
  });

  /**
   * @openapi
   * /api/notas:
   *   post:
   *     tags: [Notas]
   *     operationId: crearNota
   *     summary: Crear una nota
   *     description: Recorta espacios antes de validar. No admite campos adicionales.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/NuevaNota'
   *     responses:
   *       '201':
   *         description: Nota creada.
   *         headers:
   *           Location:
   *             description: URL de la nota creada.
   *             schema:
   *               type: string
   *               example: /api/notas/1
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Nota'
   *       '400':
   *         $ref: '#/components/responses/BodyInvalido'
   *       '500':
   *         $ref: '#/components/responses/ErrorInterno'
   */
  router.post('/', validateBody(notaSchema), (req, res) => {
    const nota = notasService.crear(req.body);
    res.location(`/api/notas/${nota.id}`).status(201).json(nota);
  });

  /**
   * @openapi
   * /api/notas/{id}:
   *   delete:
   *     tags: [Notas]
   *     operationId: eliminarNota
   *     summary: Eliminar una nota
   *     parameters:
   *       - $ref: '#/components/parameters/NotaId'
   *     responses:
   *       '204':
   *         description: Nota eliminada. Respuesta sin body.
   *       '404':
   *         $ref: '#/components/responses/NotaNoEncontrada'
   *       '500':
   *         $ref: '#/components/responses/ErrorInterno'
   */
  router.delete('/:id', (req, res) => {
    notasService.eliminar(Number(req.params.id));
    res.status(204).end();
  });

  /**
   * @openapi
   * /api/notas/{id}/resumen:
   *   post:
   *     tags: [Notas, IA]
   *     operationId: resumirNota
   *     summary: Resumir una nota en tres viñetas breves en español
   *     description: No requiere body. Busca la nota antes de llamar a DeepSeek. No modifica la nota. Límite de salida de 256 tokens.
   *     parameters:
   *       - $ref: '#/components/parameters/NotaId'
   *     responses:
   *       '200':
   *         description: Identificador, resumen y consumo reportado por DeepSeek.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ResumenIA'
   *       '400':
   *         $ref: '#/components/responses/BodyInvalido'
   *       '404':
   *         $ref: '#/components/responses/NotaNoEncontrada'
   *       '429':
   *         $ref: '#/components/responses/IALimite'
   *       '502':
   *         $ref: '#/components/responses/IAError'
   *       '503':
   *         $ref: '#/components/responses/IANoDisponible'
   *       '500':
   *         $ref: '#/components/responses/ErrorInterno'
   */
  router.post('/:id/resumen', async (req, res) => {
    // Buscar primero: una nota inexistente nunca consume una llamada a DeepSeek.
    const nota = notasService.obtener(Number(req.params.id));
    const { respuesta, uso } = await deepseekService.resumir(nota);
    res.json({ notaId: nota.id, resumen: respuesta, uso });
  });

  return router;
}

module.exports = { createNotasRouter };
