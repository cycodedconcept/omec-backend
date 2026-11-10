const { param, query } = require('express-validator');

const list = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  query('search').optional().trim(),
  query('isRead').optional().isIn(['true', 'false']).withMessage('isRead must be true or false'),
  query('type').optional().trim().isLength({ min: 1, max: 50 }),
];

const notificationId = [
  param('id').isInt({ min: 1 }).withMessage('A valid notification ID is required').toInt(),
];

module.exports = { list, notificationId };
