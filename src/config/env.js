const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const integer = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: integer(process.env.PORT, 3000),
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: integer(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME || 'light_shade_hms',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'development-only-change-this-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
    resetExpiresIn: process.env.RESET_TOKEN_EXPIRES_IN || '15m',
  },
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  socketCorsOrigin: process.env.SOCKET_CORS_ORIGIN || '*',
  enforceHttps: process.env.ENFORCE_HTTPS !== 'false',
  authRateLimit: {
    windowMs: integer(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: integer(process.env.AUTH_RATE_LIMIT_MAX, 10),
  },
};
