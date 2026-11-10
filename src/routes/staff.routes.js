const router = require('express').Router();
const controller = require('../controllers/staff.controller');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validate');
const validators = require('../validators/staff.validator');

router.use(auth);
router.post('/', roleCheck('Admin'), validators.create, validate, controller.create);
router.get('/', roleCheck('Admin', 'Doctor', 'Nurse', 'Receptionist'), validators.list, validate, controller.list);
router.get('/:id', roleCheck('Admin', 'Doctor', 'Nurse', 'Receptionist'), validators.identifier, validate, controller.getById);
router.put('/:id', roleCheck('Admin'), validators.update, validate, controller.update);
router.patch('/:id/status', roleCheck('Admin'), validators.status, validate, controller.updateStatus);

module.exports = router;
