const router = require('express').Router();
const controller = require('../controllers/dashboard.controller');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validate');
const validators = require('../validators/dashboard.validator');

router.use(auth, roleCheck('Admin', 'Doctor', 'Nurse', 'Receptionist'));
router.get('/stats', controller.stats);
router.get('/chart', controller.chart);
router.get('/today-appointments', validators.todayAppointments, validate, controller.todayAppointments);

module.exports = router;
