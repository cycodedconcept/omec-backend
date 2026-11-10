const router = require('express').Router();
const controller = require('../controllers/appointment.controller');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validate');
const validators = require('../validators/appointment.validator');

router.use(auth);
router.post('/', roleCheck('Admin', 'Receptionist'), validators.create, validate, controller.create);
router.get('/today', roleCheck('Admin', 'Doctor', 'Nurse', 'Receptionist'), validators.list, validate, controller.today);
router.get('/', roleCheck('Admin', 'Doctor', 'Nurse', 'Receptionist'), validators.list, validate, controller.list);
router.patch('/:id/reschedule', roleCheck('Admin', 'Receptionist'), validators.reschedule, validate, controller.reschedule);
router.patch('/:id/cancel', roleCheck('Admin', 'Doctor', 'Receptionist'), validators.cancel, validate, controller.cancel);
router.patch('/:id/status', roleCheck('Admin', 'Doctor', 'Nurse'), validators.status, validate, controller.updateStatus);

module.exports = router;
