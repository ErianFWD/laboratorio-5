const express = require('express');
const { AppError } = require('./utils/app-error');
const { errorHandler } = require('./middlewares/error-handler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.use((req, res, next) => {
    next(new AppError(404, 'NO_ENCONTRADO', 'La ruta solicitada no existe.'));
  });
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
