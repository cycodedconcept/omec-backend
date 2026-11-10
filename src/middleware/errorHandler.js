const env = require('../config/env');

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = error.status || error.statusCode || 500;
  let message = error.message || 'Internal server error';

  if (error.name === 'SequelizeValidationError') status = 422;
  if (error.name === 'SequelizeUniqueConstraintError') status = 409;
  if (error.name === 'SequelizeForeignKeyConstraintError') status = 409;
  if (status >= 500 && env.nodeEnv === 'production') message = 'Internal server error';

  return res.status(status).json({ success: false, data: null, error: message });
}

module.exports = errorHandler;
