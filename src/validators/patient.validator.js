const { body, param, query } = require('express-validator');

const patientFields = () => [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('dateOfBirth').optional({ nullable: true }).isISO8601().withMessage('Date of birth must be a valid date').toDate(),
  body('gender').optional({ nullable: true }).isIn(['Male', 'Female', 'Other']).withMessage('Gender must be Male, Female, or Other'),
  body('phone').optional({ nullable: true }).trim(),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email must be valid').normalizeEmail(),
  body('address').optional({ nullable: true }).trim(),
  body('emergencyContactName').optional({ nullable: true }).trim(),
  body('emergencyContactPhone').optional({ nullable: true }).trim(),
];

const create = patientFields();
const update = patientFields().map((validation) => validation.optional());
const patientId = [param('id').matches(/^(\d+|LSH-\d+)$/i).withMessage('A valid patient ID is required')];
const status = [
  ...patientId,
  body('status').isIn(['Active', 'Admitted', 'Discharged']).withMessage('Status must be Active, Admitted, or Discharged'),
];
const visit = [
  ...patientId,
  body('visitDate').optional().isISO8601().withMessage('Visit date must be valid').toDate(),
  body('reason').trim().notEmpty().withMessage('Visit reason is required'),
  body('diagnosis').optional({ nullable: true }).trim(),
  body('notes').optional({ nullable: true }).trim(),
];
const list = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  query('status').optional().isIn(['Active', 'Admitted', 'Discharged']).withMessage('Invalid patient status'),
  query('registeredFrom').optional().isISO8601().withMessage('registeredFrom must be a valid date'),
  query('registeredTo').optional().isISO8601().withMessage('registeredTo must be a valid date'),
];

module.exports = { create, update, patientId, status, visit, list };
