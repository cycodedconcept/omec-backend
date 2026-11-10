const { Op } = require('sequelize');
const {
  Appointment, Patient, Staff, Department, User, Role, sequelize,
} = require('../models');
const auditService = require('../services/audit.service');
const notificationService = require('../services/notification.service');
const dashboardService = require('../services/dashboard.service');
const { success, failure } = require('../utils/response');

const statuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No-Show'];

const normalizeTime = (time) => (time.length === 5 ? `${time}:00` : time);
const slotKey = (doctorId, date, time) => `${doctorId}|${date}|${normalizeTime(time)}`;
const todayInLagos = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const serialize = (record) => {
  const data = record.toJSON ? record.toJSON() : { ...record };
  delete data.slotKey;
  return data;
};

const appointmentInclude = [
  { model: Patient, as: 'patient', attributes: ['id', 'patientNumber', 'firstName', 'lastName', 'phone'] },
  {
    model: Staff, as: 'doctor', attributes: ['id', 'staffNumber', 'specialization', 'status'],
    include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }],
  },
  { model: Department, as: 'department', attributes: ['id', 'name', 'status'] },
];

async function createStatusNotifications(appointment, previousStatus, transaction) {
  const doctor = await Staff.findByPk(appointment.doctorId, { attributes: ['id', 'userId'], transaction });
  const userIds = [...new Set([doctor?.userId, appointment.createdBy].filter(Boolean))];
  const notifications = [];
  for (const userId of userIds) {
    notifications.push(await notificationService.createNotification({
      userId,
      type: 'APPOINTMENT_STATUS_CHANGED',
      title: 'Appointment status updated',
      message: `Appointment #${appointment.id} changed from ${previousStatus} to ${appointment.status}`,
      relatedType: 'appointment',
      relatedId: appointment.id,
    }, transaction));
  }
  const adminNotifications = await notificationService.createAdminNotifications({
    type: 'APPOINTMENT_STATUS_CHANGED', title: 'Appointment status updated',
    message: `Appointment #${appointment.id} changed from ${previousStatus} to ${appointment.status}`,
    relatedType: 'appointment', relatedId: appointment.id,
    excludeUserIds: userIds,
  }, transaction);
  const adminIds = adminNotifications.map((item) => item.userId);
  return { notifications, adminNotifications, doctorId: doctor?.id || appointment.doctorId, userIds: [...new Set([...userIds, ...adminIds])] };
}

function emitStatusChanges(result, appointment) {
  result.notifications.forEach(notificationService.emitNotification);
  notificationService.emitNotifications(result.adminNotifications || []);
  const payload = serialize(appointment);
  result.userIds.forEach((userId) => notificationService.emitToUser(userId, 'appointment:status_changed', payload));
}

async function validateReferences({ patientId, doctorId, departmentId, transaction }) {
  const [patient, doctor, department] = await Promise.all([
    Patient.findByPk(patientId, { transaction }),
    Staff.findByPk(doctorId, {
      transaction,
      include: [{ model: User, as: 'user', include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }] }],
    }),
    Department.findByPk(departmentId, { transaction }),
  ]);
  if (!patient) return { error: 'Patient not found', status: 404 };
  if (!doctor || doctor.status !== 'Active' || doctor.user?.status !== 'Active' || doctor.user?.role?.name !== 'Doctor') {
    return { error: 'An active Doctor staff profile is required', status: 422 };
  }
  if (!department || department.status !== 'Active') return { error: 'An active department is required', status: 422 };
  if (doctor.departmentId !== department.id) return { error: 'Doctor is not assigned to the selected department', status: 422 };
  return { patient, doctor, department };
}

const conflictFailure = (res) => failure(res, 'Doctor already has a non-cancelled appointment in that time slot', 409);
const isSlotConflict = (error) => error.name === 'SequelizeUniqueConstraintError'
  || error.original?.code === 'ER_DUP_ENTRY';

async function create(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const references = await validateReferences({ ...req.body, transaction });
      if (references.error) return references;
      const appointment = await Appointment.create({
        patientId: req.body.patientId,
        doctorId: req.body.doctorId,
        departmentId: req.body.departmentId,
        appointmentDate: req.body.appointmentDate,
        appointmentTime: normalizeTime(req.body.appointmentTime),
        slotKey: slotKey(req.body.doctorId, req.body.appointmentDate, req.body.appointmentTime),
        reason: req.body.reason || null,
        status: 'Pending',
        createdBy: req.user.id,
      }, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'CREATE', tableName: 'appointments', recordId: appointment.id,
        afterValues: serialize(appointment), ipAddress: req.ip, transaction,
      });
      const notification = await notificationService.createNotification({
        userId: references.doctor.userId,
        type: 'APPOINTMENT_BOOKED',
        title: 'New appointment booked',
        message: `A new appointment has been booked for ${appointment.appointmentDate} at ${appointment.appointmentTime}`,
        relatedType: 'appointment',
        relatedId: appointment.id,
      }, transaction);
      const adminNotifications = await notificationService.createAdminNotifications({
        type: 'APPOINTMENT_BOOKED', title: 'New appointment booked',
        message: `Appointment #${appointment.id} was booked for ${appointment.appointmentDate} at ${appointment.appointmentTime}`,
        relatedType: 'appointment', relatedId: appointment.id,
      }, transaction);
      return { appointmentId: appointment.id, doctorId: references.doctor.id, notification, adminNotifications };
    });
    if (result.error) return failure(res, result.error, result.status);
    const appointment = await Appointment.findByPk(result.appointmentId, { include: appointmentInclude });
    notificationService.emitNotification(result.notification);
    notificationService.emitNotifications(result.adminNotifications);
    notificationService.emitToDoctor(result.doctorId, 'appointment:booked', serialize(appointment));
    dashboardService.scheduleStatsUpdate();
    return success(res, serialize(appointment), 201);
  } catch (error) {
    if (isSlotConflict(error)) return conflictFailure(res);
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const where = {};
    if (req.query.date) where.appointmentDate = req.query.date;
    if (req.query.doctorId) where.doctorId = req.query.doctorId;
    if (req.query.departmentId) where.departmentId = req.query.departmentId;
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) {
      const search = req.query.search.trim();
      where[Op.or] = [
        { reason: { [Op.like]: `%${search}%` } },
        { '$patient.patient_number$': { [Op.like]: `%${search}%` } },
        { '$patient.first_name$': { [Op.like]: `%${search}%` } },
        { '$patient.last_name$': { [Op.like]: `%${search}%` } },
      ];
    }
    const { count, rows } = await Appointment.findAndCountAll({
      where, include: appointmentInclude, distinct: true, subQuery: false,
      limit, offset: (page - 1) * limit,
      order: [['appointmentDate', 'ASC'], ['appointmentTime', 'ASC']],
    });
    return success(res, {
      items: rows.map(serialize),
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (error) {
    return next(error);
  }
}

async function today(req, res, next) {
  req.query.date = todayInLagos();
  return list(req, res, next);
}

async function reschedule(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const appointment = await Appointment.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!appointment) return { error: 'Appointment not found', status: 404 };
      if (appointment.status === 'Cancelled') return { error: 'Cancelled appointments cannot be rescheduled', status: 409 };
      const before = serialize(appointment);
      await appointment.update({
        appointmentDate: req.body.appointmentDate,
        appointmentTime: normalizeTime(req.body.appointmentTime),
        slotKey: slotKey(appointment.doctorId, req.body.appointmentDate, req.body.appointmentTime),
        rescheduleReason: req.body.reason,
      }, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'RESCHEDULE', tableName: 'appointments', recordId: appointment.id,
        beforeValues: before, afterValues: serialize(appointment), ipAddress: req.ip, transaction,
      });
      const doctor = await Staff.findByPk(appointment.doctorId, { attributes: ['id', 'userId'], transaction });
      const userIds = [...new Set([doctor?.userId, appointment.createdBy].filter(Boolean))];
      const values = {
        type: 'APPOINTMENT_RESCHEDULED', title: 'Appointment rescheduled',
        message: `Appointment #${appointment.id} was moved to ${appointment.appointmentDate} at ${appointment.appointmentTime}`,
        relatedType: 'appointment', relatedId: appointment.id,
      };
      const notifications = [];
      for (const userId of userIds) {
        notifications.push(await notificationService.createNotification({ ...values, userId }, transaction));
      }
      const adminNotifications = await notificationService.createAdminNotifications({ ...values, excludeUserIds: userIds }, transaction);
      return { appointmentId: appointment.id, notifications, adminNotifications };
    });
    if (result.error) return failure(res, result.error, result.status);
    const appointment = await Appointment.findByPk(result.appointmentId, { include: appointmentInclude });
    notificationService.emitNotifications(result.notifications || []);
    notificationService.emitNotifications(result.adminNotifications || []);
    dashboardService.scheduleStatsUpdate();
    return success(res, serialize(appointment));
  } catch (error) {
    if (isSlotConflict(error)) return conflictFailure(res);
    return next(error);
  }
}

async function cancel(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const appointment = await Appointment.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!appointment) return { error: 'Appointment not found', status: 404 };
      if (appointment.status === 'Cancelled') return { error: 'Appointment is already cancelled', status: 409 };
      const before = serialize(appointment);
      const previousStatus = appointment.status;
      await appointment.update({ status: 'Cancelled', cancellationReason: req.body.reason, slotKey: null }, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'CANCEL', tableName: 'appointments', recordId: appointment.id,
        beforeValues: before, afterValues: serialize(appointment), ipAddress: req.ip, transaction,
      });
      const notificationResult = await createStatusNotifications(appointment, previousStatus, transaction);
      return { appointmentId: appointment.id, ...notificationResult };
    });
    if (result.error) return failure(res, result.error, result.status);
    const appointment = await Appointment.findByPk(result.appointmentId, { include: appointmentInclude });
    emitStatusChanges(result, appointment);
    dashboardService.scheduleStatsUpdate();
    return success(res, serialize(appointment));
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const appointment = await Appointment.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!appointment) return { error: 'Appointment not found', status: 404 };
      if (appointment.status === req.body.status) return { appointmentId: appointment.id };
      const before = serialize(appointment);
      const previousStatus = appointment.status;
      const changes = { status: req.body.status };
      if (req.body.status === 'Cancelled') {
        changes.slotKey = null;
        changes.cancellationReason = req.body.reason;
      } else if (appointment.status === 'Cancelled') {
        changes.slotKey = slotKey(appointment.doctorId, appointment.appointmentDate, appointment.appointmentTime);
        changes.cancellationReason = null;
      }
      await appointment.update(changes, { transaction });
      await auditService.writeAudit({
        userId: req.user.id, action: 'UPDATE_STATUS', tableName: 'appointments', recordId: appointment.id,
        beforeValues: before, afterValues: serialize(appointment), ipAddress: req.ip, transaction,
      });
      const notificationResult = await createStatusNotifications(appointment, previousStatus, transaction);
      return { appointmentId: appointment.id, ...notificationResult };
    });
    if (result.error) return failure(res, result.error, result.status);
    const appointment = await Appointment.findByPk(result.appointmentId, { include: appointmentInclude });
    if (result.notifications) emitStatusChanges(result, appointment);
    dashboardService.scheduleStatsUpdate();
    return success(res, serialize(appointment));
  } catch (error) {
    if (isSlotConflict(error)) return conflictFailure(res);
    return next(error);
  }
}

module.exports = { create, list, today, reschedule, cancel, updateStatus, statuses };
