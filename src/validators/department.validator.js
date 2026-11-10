const { body, param, query } = require('express-validator');

const departmentId = [
  param('id').isInt({ min: 1 }).withMessage('A valid department ID is required').toInt(),
];

const create = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Department name must be between 2 and 100 characters'),
  body('description').optional({ nullable: true }).trim(),
  body('capacity').optional().isInt({ min: 0 }).withMessage('Capacity must be zero or greater').toInt(),
];

const update = [
  ...departmentId,
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Department name must be between 2 and 100 characters'),
  body('description').optional({ nullable: true }).trim(),
  body('status').optional().isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive'),
];

const list = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  query('status').optional().isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive'),
];

const assignStaff = [
  ...departmentId,
  body('staffId').isInt({ min: 1 }).withMessage('A valid staff ID is required').toInt(),
];

const removeStaff = [
  ...departmentId,
  param('staffId').isInt({ min: 1 }).withMessage('A valid staff ID is required').toInt(),
];

const capacity = [
  ...departmentId,
  body('capacity').isInt({ min: 0 }).withMessage('Capacity must be zero or greater').toInt(),
];

module.exports = { departmentId, create, update, list, assignStaff, removeStaff, capacity };
