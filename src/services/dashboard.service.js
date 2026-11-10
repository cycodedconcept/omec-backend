const { Op, QueryTypes } = require('sequelize');
const { Patient, Staff, Appointment, sequelize } = require('../models');
const { getIo } = require('../config/socket');

const dateInLagos = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

const startOfUtcDay = (date) => new Date(`${date}T00:00:00.000Z`);
const addDays = (date, days) => {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};

function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

async function getStats() {
  const today = dateInLagos();
  const yesterday = addDays(today, -1);
  const currentStart = startOfUtcDay(addDays(today, -29));
  const previousStart = startOfUtcDay(addDays(today, -59));
  const previousEnd = startOfUtcDay(addDays(today, -29));
  const currentRange = { [Op.gte]: currentStart };
  const previousRange = { [Op.gte]: previousStart, [Op.lt]: previousEnd };

  const [
    totalPatients, currentPatients, previousPatients,
    totalStaff, currentStaff, previousStaff,
    appointmentsToday, appointmentsYesterday,
  ] = await Promise.all([
    Patient.count(),
    Patient.count({ where: { createdAt: currentRange } }),
    Patient.count({ where: { createdAt: previousRange } }),
    Staff.count(),
    Staff.count({ where: { createdAt: currentRange } }),
    Staff.count({ where: { createdAt: previousRange } }),
    Appointment.count({ where: { appointmentDate: today, status: { [Op.ne]: 'Cancelled' } } }),
    Appointment.count({ where: { appointmentDate: yesterday, status: { [Op.ne]: 'Cancelled' } } }),
  ]);

  return {
    asOfDate: today,
    totalPatients: { value: totalPatients, percentChange: percentChange(currentPatients, previousPatients) },
    totalStaff: { value: totalStaff, percentChange: percentChange(currentStaff, previousStaff) },
    appointmentsToday: { value: appointmentsToday, percentChange: percentChange(appointmentsToday, appointmentsYesterday) },
    revenueToday: { value: 0, percentChange: 0, currency: 'NGN', placeholder: true },
  };
}

function monthKeys(count = 12) {
  const now = new Date();
  const result = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    result.push(date.toISOString().slice(0, 7));
  }
  return result;
}

async function getChart() {
  const months = monthKeys(12);
  const rows = await sequelize.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS patient_count
    FROM patients
    WHERE created_at >= :startDate
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
    ORDER BY month ASC
  `, {
    replacements: { startDate: `${months[0]}-01 00:00:00` },
    type: QueryTypes.SELECT,
  });
  const patientCounts = new Map(rows.map((row) => [row.month, Number(row.patient_count)]));
  return months.map((month) => ({
    month,
    patientInflow: patientCounts.get(month) || 0,
    labTestCount: 0,
    revenue: 0,
  }));
}

async function emitStatsUpdate() {
  const stats = await getStats();
  getIo()?.to('dashboard').emit('dashboard:stats_updated', stats);
  return stats;
}

function scheduleStatsUpdate() {
  if (![Patient?.count, Staff?.count, Appointment?.count].every((method) => typeof method === 'function')) return;
  emitStatsUpdate().catch((error) => console.error('Dashboard stat push failed:', error.message));
}

module.exports = { getStats, getChart, emitStatsUpdate, scheduleStatsUpdate, dateInLagos, percentChange };
