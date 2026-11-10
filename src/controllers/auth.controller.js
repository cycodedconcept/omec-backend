const bcrypt = require('bcrypt');
const { User, Role, Staff, sequelize } = require('../models');
const env = require('../config/env');
const tokenService = require('../services/token.service');
const auditService = require('../services/audit.service');
const { success, failure } = require('../utils/response');

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  status: user.status,
  role: user.role ? { id: user.role.id, name: user.role.name } : undefined,
});

async function login(req, res, next) {
  try {
    const user = await User.unscoped().findOne({
      where: { email: req.body.email },
      include: [
        { model: Role, as: 'role', attributes: ['id', 'name'] },
        { model: Staff, as: 'staffProfile', attributes: ['id', 'status'], required: false },
      ],
    });
    if (
      !user
      || user.status !== 'Active'
      || user.staffProfile?.status === 'Inactive'
      || !(await bcrypt.compare(req.body.password, user.passwordHash))
    ) {
      return failure(res, 'Invalid email or password', 401);
    }

    await user.update({ lastLoginAt: new Date() });
    return success(res, {
      token: tokenService.signAccessToken(user),
      expiresIn: env.jwt.expiresIn,
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

function logout(req, res) {
  tokenService.revokeToken(req.auth.payload);
  return success(res, { message: 'Logged out successfully' });
}

async function resetPassword(req, res, next) {
  try {
    const user = await User.unscoped().findOne({ where: { email: req.body.email } });
    if (user?.status === 'Active') {
      const resetToken = tokenService.signResetToken(user);
      const resetLink = `${env.appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
      console.log(`[email stub] Password reset link for ${user.email}: ${resetLink}`);
    }
    return success(res, { message: 'If that email is registered, a reset link has been generated' });
  } catch (error) {
    return next(error);
  }
}

async function createUser(req, res, next) {
  const transaction = await sequelize.transaction();
  try {
    const role = await Role.findByPk(req.body.roleId, { transaction });
    if (!role) {
      await transaction.rollback();
      return failure(res, 'Role not found', 404);
    }

    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const user = await User.create({
      email: req.body.email,
      passwordHash,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone || null,
      roleId: role.id,
      status: 'Active',
    }, { transaction });

    await auditService.writeAudit({
      userId: req.user.id,
      action: 'CREATE',
      tableName: 'users',
      recordId: String(user.id),
      afterValues: { email: user.email, roleId: role.id, status: user.status },
      ipAddress: req.ip,
      transaction,
    });
    await transaction.commit();

    user.role = role;
    return success(res, publicUser(user), 201);
  } catch (error) {
    await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') return failure(res, 'A user with that email already exists', 409);
    return next(error);
  }
}

module.exports = { login, logout, resetPassword, createUser };
