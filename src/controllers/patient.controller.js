const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const { Patient, PatientVisit, Staff, User, sequelize } = require('../models');
const auditService = require('../services/audit.service');
const dashboardService = require('../services/dashboard.service');
const notificationService = require('../services/notification.service');
const { success, failure } = require('../utils/response');

const editableFields = [
  'firstName', 'lastName', 'dateOfBirth', 'gender', 'phone', 'email', 'address',
  'emergencyContactName', 'emergencyContactPhone',
];

const pick = (source, fields) => Object.fromEntries(
  fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]),
);

const patientWhere = (id) => (/^LSH-/i.test(id)
  ? { patientNumber: id.toUpperCase() }
  : { id: Number(id) });

async function create(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const created = await Patient.create({
        ...pick(req.body, editableFields),
        patientNumber: `TMP-${randomUUID().replaceAll('-', '').slice(0, 20)}`,
        status: 'Active',
      }, { transaction });
      await created.update({ patientNumber: `LSH-${String(created.id).padStart(3, '0')}` }, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'CREATE', tableName: 'patients', recordId: created.id,
        afterValues: created.toJSON(), ipAddress: req.ip, transaction,
      });
      const notifications = await notificationService.createAdminNotifications({
        type: 'PATIENT_REGISTERED', title: 'New patient registered',
        message: `${created.firstName} ${created.lastName} (${created.patientNumber}) was registered`,
        relatedType: 'patient', relatedId: created.id,
      }, transaction);
      return { patient: created, notifications };
    });
    notificationService.emitNotifications(result.notifications);
    dashboardService.scheduleStatsUpdate();
    return success(res, result.patient, 201);
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const where = {};
    if (req.query.search) {
      const search = req.query.search.trim();
      where[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { patientNumber: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }
    if (req.query.status) where.status = req.query.status;
    if (req.query.registeredFrom || req.query.registeredTo) {
      where.createdAt = {};
      if (req.query.registeredFrom) where.createdAt[Op.gte] = new Date(`${req.query.registeredFrom}T00:00:00.000Z`);
      if (req.query.registeredTo) where.createdAt[Op.lte] = new Date(`${req.query.registeredTo}T23:59:59.999Z`);
    }
    const { count, rows } = await Patient.findAndCountAll({
      where, limit, offset: (page - 1) * limit, order: [['createdAt', 'DESC']], distinct: true,
    });
    return success(res, {
      items: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const patient = await Patient.findOne({
      where: patientWhere(req.params.id),
      include: [{
        model: PatientVisit,
        as: 'visits',
        include: [{ model: Staff, as: 'staff', include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName'] }] }],
        separate: true,
        order: [['visitDate', 'DESC']],
      }],
    });
    if (!patient) return failure(res, 'Patient not found', 404);
    return success(res, patient);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const record = await Patient.findOne({ where: patientWhere(req.params.id), transaction, lock: transaction.LOCK.UPDATE });
      if (!record) return null;
      const before = record.toJSON();
      await record.update(pick(req.body, editableFields), { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'UPDATE', tableName: 'patients', recordId: record.id,
        beforeValues: before, afterValues: record.toJSON(), ipAddress: req.ip, transaction,
      });
      return record;
    });
    if (!result) return failure(res, 'Patient not found', 404);
    return success(res, result);
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const record = await Patient.findOne({ where: patientWhere(req.params.id), transaction, lock: transaction.LOCK.UPDATE });
      if (!record) return null;
      const before = { status: record.status };
      await record.update({ status: req.body.status }, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'UPDATE_STATUS', tableName: 'patients', recordId: record.id,
        beforeValues: before, afterValues: { status: record.status }, ipAddress: req.ip, transaction,
      });
      const notifications = await notificationService.createAdminNotifications({
        type: 'PATIENT_STATUS_CHANGED', title: 'Patient status updated',
        message: `Patient ${record.patientNumber} status changed to ${record.status}`,
        relatedType: 'patient', relatedId: record.id,
      }, transaction);
      return { patient: record, notifications };
    });
    if (!result) return failure(res, 'Patient not found', 404);
    notificationService.emitNotifications(result.notifications);
    return success(res, result.patient);
  } catch (error) {
    return next(error);
  }
}

async function addVisit(req, res, next) {
  try {
    const visit = await sequelize.transaction(async (transaction) => {
      const patient = await Patient.findOne({ where: patientWhere(req.params.id), transaction });
      if (!patient) return null;
      const staff = await Staff.findOne({ where: { userId: req.user.id }, transaction });
      const created = await PatientVisit.create({
        patientId: patient.id,
        staffId: staff?.id || null,
        visitDate: req.body.visitDate || new Date(),
        reason: req.body.reason,
        diagnosis: req.body.diagnosis || null,
        notes: req.body.notes || null,
        createdBy: req.user.id,
      }, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'CREATE', tableName: 'patient_visits', recordId: created.id,
        afterValues: created.toJSON(), ipAddress: req.ip, transaction,
      });
      return created;
    });
    if (!visit) return failure(res, 'Patient not found', 404);
    return success(res, visit, 201);
  } catch (error) {
    return next(error);
  }
}

module.exports = { create, list, getById, update, updateStatus, addVisit };
