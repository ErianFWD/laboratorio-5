const { Router } = require('express');
const { validateBody } = require('../middlewares/validate-body');
const { preguntaSchema } = require('../utils/schemas');

function createIaRouter({ claudeService }) {
  const router = Router();

  router.post('/preguntar', validateBody(preguntaSchema), async (req, res) => {
    res.json(await claudeService.preguntar(req.body.pregunta));
  });

  return router;
}

module.exports = { createIaRouter };
