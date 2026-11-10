const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const revokedTokens = new Map();

function purgeExpired() {
  const now = Date.now();
  for (const [jti, expiresAt] of revokedTokens.entries()) {
    if (expiresAt <= now) revokedTokens.delete(jti);
  }
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role.name, type: 'access' },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn, jwtid: randomUUID() },
  );
}

function signResetToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, type: 'password-reset' },
    env.jwt.secret,
    { expiresIn: env.jwt.resetExpiresIn, jwtid: randomUUID() },
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

function revokeToken(payload) {
  purgeExpired();
  if (payload.jti && payload.exp) revokedTokens.set(payload.jti, payload.exp * 1000);
}

function isRevoked(jti) {
  purgeExpired();
  return Boolean(jti && revokedTokens.has(jti));
}

function clearRevocations() {
  revokedTokens.clear();
}

module.exports = {
  signAccessToken,
  signResetToken,
  verifyToken,
  revokeToken,
  isRevoked,
  clearRevocations,
};
