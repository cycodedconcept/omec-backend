const { Op, fn, col, literal } = require('sequelize');
const { Department, Staff, User, Role, sequelize } = require('../models');
const auditService = require('../services/audit.service');
const { success, failure } = require('../utils/response');

const doctorsInclude = {
  model: Staff,
  as: 'staff',
  attributes: ['id', 'staffNumber', 'specialization', 'status'],
  required: false,
  include: [{
    model: User,
    as: 'user',
    attributes: ['id', 'firstName', 'lastName', 'email'],
    required: true,
    include: [{ model: Role, as: 'role', attributes: ['id', 'name'], where: { name: 'Doctor' }, required: true }],
  }],
};

async function create(req, res, next) {
  try {
    const department = await sequelize.transaction(async (transaction) => {
      const record = await Department.create({
        name: req.body.name,
        description: req.body.description || null,
        capacity: req.body.capacity ?? 0,
        status: 'Active',
      }, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'CREATE', tableName: 'departments', recordId: record.id,
        afterValues: record.toJSON(), ipAddress: req.ip, transaction,
      });
      return record;
    });
    return success(res, department, 201);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return failure(res, 'A department with that name already exists', 409);
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) {
      const search = req.query.search.trim();
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Department.findAndCountAll({
      where,
      attributes: {
        include: [[literal('(SELECT COUNT(*) FROM staff AS s WHERE s.department_id = Department.id)'), 'staffCount']],
      },
      include: [doctorsInclude],
      distinct: true,
      limit,
      offset: (page - 1) * limit,
      order: [['name', 'ASC']],
      subQuery: false,
    });
    return success(res, {
      items: rows.map((department) => {
        const data = department.toJSON();
        data.assignedDoctors = data.staff || [];
        delete data.staff;
        return data;
      }),
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const record = await Department.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!record) return null;
      const before = record.toJSON();
      const changes = Object.fromEntries(['name', 'description', 'status']
        .filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]]));
      await record.update(changes, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'UPDATE', tableName: 'departments', recordId: record.id,
        beforeValues: before, afterValues: record.toJSON(), ipAddress: req.ip, transaction,
      });
      return record;
    });
    if (!result) return failure(res, 'Department not found', 404);
    return success(res, result);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return failure(res, 'A department with that name already exists', 409);
    return next(error);
  }
}

async function assignStaff(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const department = await Department.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!department) return { error: 'Department not found', status: 404 };
      const staff = await Staff.findByPk(req.body.staffId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!staff) return { error: 'Staff member not found', status: 404 };
      if (staff.departmentId === department.id) return { error: 'Staff member is already assigned to this department', status: 409 };
      if (department.capacity > 0) {
        const assignedCount = await Staff.count({ where: { departmentId: department.id }, transaction });
        if (assignedCount >= department.capacity) return { error: 'Department capacity has been reached', status: 409 };
      }
      const before = { departmentId: staff.departmentId };
      await staff.update({ departmentId: department.id }, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'ASSIGN_STAFF', tableName: 'departments', recordId: department.id,
        beforeValues: { staffId: staff.id, ...before }, afterValues: { staffId: staff.id, departmentId: department.id },
        ipAddress: req.ip, transaction,
      });
      return { staff };
    });
    if (result.error) return failure(res, result.error, result.status);
    return success(res, result.staff);
  } catch (error) {
    return next(error);
  }
}

async function removeStaff(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const department = await Department.findByPk(req.params.id, { transaction });
      if (!department) return { error: 'Department not found', status: 404 };
      const staff = await Staff.findOne({
        where: { id: req.params.staffId, departmentId: department.id }, transaction, lock: transaction.LOCK.UPDATE,
      });
      if (!staff) return { error: 'Staff member is not assigned to this department', status: 404 };
      await staff.update({ departmentId: null }, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'REMOVE_STAFF', tableName: 'departments', recordId: department.id,
        beforeValues: { staffId: staff.id, departmentId: department.id }, afterValues: { staffId: staff.id, departmentId: null },
        ipAddress: req.ip, transaction,
      });
      return { staff };
    });
    if (result.error) return failure(res, result.error, result.status);
    return success(res, result.staff);
  } catch (error) {
    return next(error);
  }
}

async function updateCapacity(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const department = await Department.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!department) return { error: 'Department not found', status: 404 };
      const staffCount = await Staff.count({ where: { departmentId: department.id }, transaction });
      if (req.body.capacity > 0 && req.body.capacity < staffCount) {
        return { error: `Capacity cannot be lower than the current staff count (${staffCount})`, status: 409 };
      }
      const before = { capacity: department.capacity };
      await department.update({ capacity: req.body.capacity }, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'UPDATE_CAPACITY', tableName: 'departments', recordId: department.id,
        beforeValues: before, afterValues: { capacity: department.capacity }, ipAddress: req.ip, transaction,
      });
      return { department };
    });
    if (result.error) return failure(res, result.error, result.status);
    return success(res, result.department);
  } catch (error) {
    return next(error);
  }
}

module.exports = { create, list, update, assignStaff, removeStaff, updateCapacity };
