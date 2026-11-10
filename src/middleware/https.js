const env = require('../config/env');

function enforceHttps(req, res, next) {
  if (env.nodeEnv !== 'production' || !env.enforceHttps || req.secure) return next();
  return res.status(426).json({
    success: false,
    data: null,
    error: 'HTTPS is required',
  });
}

module.exports = enforceHttps;
