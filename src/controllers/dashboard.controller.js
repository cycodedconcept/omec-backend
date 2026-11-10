const { Op } = require('sequelize');
const { Appointment, Patient, Staff, Department, User } = require('../models');
const dashboardService = require('../services/dashboard.service');
const { success } = require('../utils/response');

async function stats(req, res, next) {
  try {
    return success(res, await dashboardService.getStats());
  } catch (error) {
    return next(error);
  }
}

async function chart(req, res, next) {
  try {
    return success(res, { items: await dashboardService.getChart() });
  } catch (error) {
    return next(error);
  }
}

async function todayAppointments(req, res, next) {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const where = { appointmentDate: dashboardService.dateInLagos() };
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) {
      const search = req.query.search;
      where[Op.or] = [
        { reason: { [Op.like]: `%${search}%` } },
        { '$patient.patient_number$': { [Op.like]: `%${search}%` } },
        { '$patient.first_name$': { [Op.like]: `%${search}%` } },
        { '$patient.last_name$': { [Op.like]: `%${search}%` } },
      ];
    }
    const include = [
      { model: Patient, as: 'patient', attributes: ['id', 'patientNumber', 'firstName', 'lastName', 'phone'] },
      {
        model: Staff, as: 'doctor', attributes: ['id', 'staffNumber', 'specialization'],
        include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName'] }],
      },
      { model: Department, as: 'department', attributes: ['id', 'name'] },
    ];
    const { count, rows } = await Appointment.findAndCountAll({
      where, include, distinct: true, subQuery: false, limit, offset: (page - 1) * limit,
      order: [['appointmentTime', 'ASC']],
    });
    return success(res, {
      items: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { stats, chart, todayAppointments };
