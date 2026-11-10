const { body, param, query } = require('express-validator');

const appointmentId = [
  param('id').isInt({ min: 1 }).withMessage('A valid appointment ID is required').toInt(),
];

const dateField = (field, required = true) => {
  const validator = body(field);
  if (!required) validator.optional();
  return validator.matches(/^\d{4}-\d{2}-\d{2}$/).withMessage(`${field} must use YYYY-MM-DD format`).isISO8601({ strict: true }).withMessage(`${field} must be a valid date`);
};

const timeField = (field, required = true) => {
  const validator = body(field);
  if (!required) validator.optional();
  return validator.matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/).withMessage(`${field} must use HH:mm or HH:mm:ss format`);
};

const create = [
  body('patientId').isInt({ min: 1 }).withMessage('A valid patient ID is required').toInt(),
  body('doctorId').isInt({ min: 1 }).withMessage('A valid Doctor staff ID is required').toInt(),
  body('departmentId').isInt({ min: 1 }).withMessage('A valid department ID is required').toInt(),
  dateField('appointmentDate'),
  timeField('appointmentTime'),
  body('reason').optional({ nullable: true }).trim(),
];

const list = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must use YYYY-MM-DD format').isISO8601({ strict: true }).withMessage('Date must be valid'),
  query('doctorId').optional().isInt({ min: 1 }).withMessage('A valid Doctor staff ID is required').toInt(),
  query('departmentId').optional().isInt({ min: 1 }).withMessage('A valid department ID is required').toInt(),
  query('status').optional().isIn(['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No-Show']).withMessage('Invalid appointment status'),
];

const reschedule = [
  ...appointmentId,
  dateField('appointmentDate'),
  timeField('appointmentTime'),
  body('reason').trim().notEmpty().withMessage('A reschedule reason is required'),
];

const cancel = [
  ...appointmentId,
  body('reason').trim().notEmpty().withMessage('A cancellation reason is required'),
];

const status = [
  ...appointmentId,
  body('status').isIn(['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No-Show']).withMessage('Invalid appointment status'),
  body('reason').if(body('status').equals('Cancelled')).trim().notEmpty().withMessage('A cancellation reason is required'),
];

module.exports = { appointmentId, create, list, reschedule, cancel, status };
