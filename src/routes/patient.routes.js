const router = require('express').Router();
const controller = require('../controllers/patient.controller');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validate');
const validators = require('../validators/patient.validator');

router.use(auth);
router.post('/', roleCheck('Admin', 'Receptionist'), validators.create, validate, controller.create);
router.get('/', roleCheck('Admin', 'Doctor', 'Nurse', 'Receptionist'), validators.list, validate, controller.list);
router.get('/:id', roleCheck('Admin', 'Doctor', 'Nurse', 'Receptionist'), validators.patientId, validate, controller.getById);
router.put('/:id', roleCheck('Admin', 'Receptionist'), validators.update, validators.patientId, validate, controller.update);
router.patch('/:id/status', roleCheck('Admin', 'Doctor', 'Nurse'), validators.status, validate, controller.updateStatus);
router.post('/:id/visits', roleCheck('Admin', 'Doctor', 'Nurse'), validators.visit, validate, controller.addVisit);

module.exports = router;
