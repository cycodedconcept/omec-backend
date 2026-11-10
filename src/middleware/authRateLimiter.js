const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');

module.exports = rateLimit({
  windowMs: env.authRateLimit.windowMs,
  limit: env.authRateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    success: false,
    data: null,
    error: 'Too many authentication requests. Please try again later.',
  }),
});
