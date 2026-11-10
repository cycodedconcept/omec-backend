const { User, Role, Staff } = require('../models');
const tokenService = require('../services/token.service');
const { failure } = require('../utils/response');

module.exports = async function auth(req, res, next) {
  const authorization = req.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return failure(res, 'Authentication required', 401);

  const token = authorization.slice(7).trim();
  if (!token) return failure(res, 'Authentication required', 401);

  try {
    const payload = tokenService.verifyToken(token);
    if (payload.type !== 'access' || tokenService.isRevoked(payload.jti)) {
      return failure(res, 'Invalid or revoked token', 401);
    }

    const user = await User.unscoped().findByPk(payload.sub, {
      attributes: { exclude: ['passwordHash'] },
      include: [
        { model: Role, as: 'role', attributes: ['id', 'name'] },
        { model: Staff, as: 'staffProfile', attributes: ['id', 'status'], required: false },
      ],
    });
    if (!user || user.status !== 'Active' || user.staffProfile?.status === 'Inactive') {
      return failure(res, 'User account is inactive or unavailable', 401);
    }

    req.user = user;
    req.auth = { token, payload };
    return next();
  } catch (error) {
    return failure(res, error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token', 401);
  }
};
