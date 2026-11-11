const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { openapi } = require('./config/swagger');
const { AppError } = require('./utils/app-error');
const { errorHandler } = require('./middlewares/error-handler');
const { createNotasService } = require('./services/notas.service');
const { createNotasRouter } = require('./routes/notas.routes');
const { createDeepSeekService } = require('./services/deepseek.service');
const { createIaRouter } = require('./routes/ia.routes');

function createApp({
  notasService = createNotasService(),
  deepseekService = createDeepSeekService(),
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.get('/', (req, res) => res.json({ documentacion: '/api-docs' }));
  app.get('/api-docs/openapi.json', (req, res) => res.json(openapi));
  app.use('/api-docs', swaggerUi.serveFiles(openapi), swaggerUi.setup(openapi, {
    customSiteTitle: 'Laboratorio #5 | API de notas',
    swaggerOptions: { validatorUrl: null },
  }));
  app.use('/api/notas', createNotasRouter({ notasService, deepseekService }));
  app.use('/api/ia', createIaRouter({ deepseekService }));

  app.use((req, res, next) => {
    next(new AppError(404, 'NO_ENCONTRADO', 'La ruta solicitada no existe.'));
  });
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
