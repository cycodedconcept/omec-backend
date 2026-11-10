const router = require('express').Router();
const controller = require('../controllers/department.controller');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validate');
const validators = require('../validators/department.validator');

router.use(auth);
router.post('/', roleCheck('Admin'), validators.create, validate, controller.create);
router.get('/', roleCheck('Admin', 'Doctor', 'Nurse', 'Receptionist'), validators.list, validate, controller.list);
router.put('/:id', roleCheck('Admin'), validators.update, validate, controller.update);
router.post('/:id/assign-staff', roleCheck('Admin'), validators.assignStaff, validate, controller.assignStaff);
router.delete('/:id/staff/:staffId', roleCheck('Admin'), validators.removeStaff, validate, controller.removeStaff);
router.patch('/:id/capacity', roleCheck('Admin'), validators.capacity, validate, controller.updateCapacity);

module.exports = router;
