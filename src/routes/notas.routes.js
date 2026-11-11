const { Router } = require('express');
const { validateBody } = require('../middlewares/validate-body');
const { notaSchema } = require('../utils/schemas');

function createNotasRouter({ notasService, claudeService }) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(notasService.listar());
  });

  router.get('/:id', (req, res) => {
    res.json(notasService.obtener(Number(req.params.id)));
  });

  router.post('/', validateBody(notaSchema), (req, res) => {
    const nota = notasService.crear(req.body);
    res.location(`/api/notas/${nota.id}`).status(201).json(nota);
  });

  router.delete('/:id', (req, res) => {
    notasService.eliminar(Number(req.params.id));
    res.status(204).end();
  });

  router.post('/:id/resumen', async (req, res) => {
    // Buscar primero: una nota inexistente nunca consume una llamada a Claude.
    const nota = notasService.obtener(Number(req.params.id));
    const { respuesta, uso } = await claudeService.resumir(nota);
    res.json({ notaId: nota.id, resumen: respuesta, uso });
  });

  return router;
}

module.exports = { createNotasRouter };
