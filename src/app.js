const express = require('express');
const { AppError } = require('./utils/app-error');
const { errorHandler } = require('./middlewares/error-handler');
const { createNotasService } = require('./services/notas.service');
const { createNotasRouter } = require('./routes/notas.routes');

function createApp({ notasService = createNotasService() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/notas', createNotasRouter({ notasService }));

  app.use((req, res, next) => {
    next(new AppError(404, 'NO_ENCONTRADO', 'La ruta solicitada no existe.'));
  });
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
