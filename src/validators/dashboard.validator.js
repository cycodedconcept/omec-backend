const { query } = require('express-validator');

const todayAppointments = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  query('search').optional().trim(),
  query('status').optional().isIn(['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No-Show']).withMessage('Invalid appointment status'),
];

module.exports = { todayAppointments };
