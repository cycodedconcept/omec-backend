const { body } = require('express-validator');

const login = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required'),
];

const resetPassword = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
];

const createUser = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('roleId').isInt({ min: 1 }).withMessage('A valid role ID is required').toInt(),
  body('phone').optional({ nullable: true }).trim(),
];

module.exports = { login, resetPassword, createUser };
