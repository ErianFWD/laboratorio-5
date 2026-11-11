const { Router } = require('express');
const { validateBody } = require('../middlewares/validate-body');
const { notaSchema } = require('../utils/schemas');

function createNotasRouter({ notasService }) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(notasService.listar());
  });

  router.get('/:id', (req, res) => {
    res.json(notasService.obtener(req.params.id));
  });

  router.post('/', validateBody(notaSchema), (req, res) => {
    const nota = notasService.crear(req.body);
    res.location(`/api/notas/${nota.id}`).status(201).json(nota);
  });

  router.delete('/:id', (req, res) => {
    notasService.eliminar(req.params.id);
    res.status(204).end();
  });

  return router;
}

module.exports = { createNotasRouter };
