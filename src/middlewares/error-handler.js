const { AppError } = require('../utils/app-error');

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { codigo: 'JSON_INVALIDO', mensaje: 'El body debe ser JSON válido.' },
    });
  }

  if (error.type === 'entity.too.large') {
    return res.status(400).json({
      error: { codigo: 'BODY_INVALIDO', mensaje: 'El body supera el límite de 64 KB.' },
    });
  }

  if (error instanceof AppError) {
    const body = { codigo: error.code, mensaje: error.message };
    if (error.details) body.detalles = error.details;
    return res.status(error.status).json({ error: body });
  }

  return res.status(500).json({
    error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error interno.' },
  });
}

module.exports = { errorHandler };
