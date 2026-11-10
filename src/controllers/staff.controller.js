const { Op } = require('sequelize');
const { Staff, User, Role, Department, sequelize } = require('../models');
const auditService = require('../services/audit.service');
const dashboardService = require('../services/dashboard.service');
const notificationService = require('../services/notification.service');
const { success, failure } = require('../utils/response');

const profileInclude = [
  {
    model: User,
    as: 'user',
    attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'status'],
    include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }],
  },
  { model: Department, as: 'department', attributes: ['id', 'name', 'status'], required: false },
];

const staffWhere = (id) => (/^\d+$/.test(id) ? { id: Number(id) } : { staffNumber: id });

async function create(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(req.body.userId, {
        include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }], transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!user) return { error: 'User not found', status: 404 };
      const existing = await Staff.findOne({ where: { userId: user.id }, transaction });
      if (existing) return { error: 'That user already has a staff profile', status: 409 };
      if (req.body.departmentId) {
        const department = await Department.findByPk(req.body.departmentId, { transaction });
        if (!department) return { error: 'Department not found', status: 404 };
      }
      const staff = await Staff.create({
        userId: user.id,
        staffNumber: req.body.staffNumber,
        departmentId: req.body.departmentId || null,
        specialization: req.body.specialization || null,
        status: 'Active',
      }, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'CREATE', tableName: 'staff', recordId: staff.id,
        afterValues: staff.toJSON(), ipAddress: req.ip, transaction,
      });
      const notifications = await notificationService.createAdminNotifications({
        type: 'STAFF_ADDED', title: 'New staff profile added',
        message: `${user.firstName} ${user.lastName} was added as staff (${staff.staffNumber})`,
        relatedType: 'staff', relatedId: staff.id,
      }, transaction);
      return { staffId: staff.id, notifications };
    });
    if (result.error) return failure(res, result.error, result.status);
    notificationService.emitNotifications(result.notifications || []);
    const staff = await Staff.findByPk(result.staffId, { include: profileInclude });
    dashboardService.scheduleStatsUpdate();
    return success(res, staff, 201);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return failure(res, 'Staff number is already in use', 409);
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const where = {};
    const userWhere = {};
    const roleWhere = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.departmentId) where.departmentId = req.query.departmentId;
    if (req.query.search) {
      const search = req.query.search.trim();
      where[Op.or] = [
        { staffNumber: { [Op.like]: `%${search}%` } },
        { specialization: { [Op.like]: `%${search}%` } },
        { '$user.first_name$': { [Op.like]: `%${search}%` } },
        { '$user.last_name$': { [Op.like]: `%${search}%` } },
        { '$user.email$': { [Op.like]: `%${search}%` } },
      ];
    }
    if (req.query.role) {
      if (/^\d+$/.test(req.query.role)) roleWhere.id = Number(req.query.role);
      else roleWhere.name = req.query.role;
    }
    const include = [
      {
        model: User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'status'],
        where: userWhere,
        include: [{ model: Role, as: 'role', attributes: ['id', 'name'], where: roleWhere, required: Boolean(req.query.role) }],
      },
      { model: Department, as: 'department', attributes: ['id', 'name', 'status'], required: false },
    ];
    const { count, rows } = await Staff.findAndCountAll({
      where, include, distinct: true, limit, offset: (page - 1) * limit, order: [['createdAt', 'DESC']],
      subQuery: false,
    });
    return success(res, { items: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const staff = await Staff.findOne({ where: staffWhere(req.params.id), include: profileInclude });
    if (!staff) return failure(res, 'Staff member not found', 404);
    return success(res, staff);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const staff = await Staff.findOne({ where: staffWhere(req.params.id), transaction, lock: transaction.LOCK.UPDATE });
      if (!staff) return null;
      if (req.body.departmentId) {
        const department = await Department.findByPk(req.body.departmentId, { transaction });
        if (!department) return { error: 'Department not found', status: 404 };
      }
      const before = staff.toJSON();
      const changes = Object.fromEntries(['staffNumber', 'departmentId', 'specialization']
        .filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
      await staff.update(changes, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'UPDATE', tableName: 'staff', recordId: staff.id,
        beforeValues: before, afterValues: staff.toJSON(), ipAddress: req.ip, transaction,
      });
      const notifications = await notificationService.createAdminNotifications({
        type: 'STAFF_STATUS_CHANGED', title: 'Staff status updated',
        message: `Staff member ${staff.staffNumber} status changed to ${staff.status}`,
        relatedType: 'staff', relatedId: staff.id,
      }, transaction);
      return { staffId: staff.id, notifications };
    });
    if (!result) return failure(res, 'Staff member not found', 404);
    notificationService.emitNotifications(result.notifications || []);
    if (result.error) return failure(res, result.error, result.status);
    const staff = await Staff.findByPk(result.staffId, { include: profileInclude });
    dashboardService.scheduleStatsUpdate();
    return success(res, staff);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return failure(res, 'Staff number is already in use', 409);
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const staff = await Staff.findOne({ where: staffWhere(req.params.id), transaction, lock: transaction.LOCK.UPDATE });
      if (!staff) return null;
      const user = await User.findByPk(staff.userId, { transaction, lock: transaction.LOCK.UPDATE });
      const before = { staffStatus: staff.status, userStatus: user?.status };
      await staff.update({ status: req.body.status }, { transaction });
      if (user) await user.update({ status: req.body.status }, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'UPDATE_STATUS', tableName: 'staff', recordId: staff.id,
        beforeValues: before, afterValues: { staffStatus: staff.status, userStatus: user?.status },
        ipAddress: req.ip, transaction,
      });
      return { staffId: staff.id };
    });
    if (!result) return failure(res, 'Staff member not found', 404);
    const staff = await Staff.findByPk(result.staffId, { include: profileInclude });
    return success(res, staff);
  } catch (error) {
    return next(error);
  }
}

module.exports = { create, list, getById, update, updateStatus };
