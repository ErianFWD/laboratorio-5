const { AppError } = require('../utils/app-error');

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new AppError(400, 'VALIDACION_ERROR', 'El body no cumple el esquema.',
        result.error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        }))));
    }

    req.body = result.data;
    return next();
  };
}

module.exports = { validateBody };
