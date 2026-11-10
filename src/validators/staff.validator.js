const { body, param, query } = require('express-validator');

const identifier = [
  param('id').matches(/^(\d+|[A-Za-z0-9-]+)$/).withMessage('A valid staff ID is required'),
];

const create = [
  body('userId').isInt({ min: 1 }).withMessage('A valid user ID is required').toInt(),
  body('staffNumber').trim().isLength({ min: 2, max: 30 }).withMessage('Staff number must be between 2 and 30 characters'),
  body('departmentId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('A valid department ID is required').toInt(),
  body('specialization').optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage('Specialization cannot exceed 150 characters'),
];

const update = [
  ...identifier,
  body('staffNumber').optional().trim().isLength({ min: 2, max: 30 }).withMessage('Staff number must be between 2 and 30 characters'),
  body('departmentId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('A valid department ID is required').toInt(),
  body('specialization').optional({ nullable: true }).trim().isLength({ max: 150 }).withMessage('Specialization cannot exceed 150 characters'),
];

const status = [
  ...identifier,
  body('status').isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive'),
];

const list = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  query('role').optional().trim().notEmpty().withMessage('Role filter cannot be empty'),
  query('departmentId').optional().isInt({ min: 1 }).withMessage('A valid department ID is required').toInt(),
  query('status').optional().isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive'),
];

module.exports = { identifier, create, update, status, list };
