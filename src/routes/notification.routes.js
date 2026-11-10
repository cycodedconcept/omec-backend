const router = require('express').Router();
const controller = require('../controllers/notification.controller');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validate');
const validators = require('../validators/notification.validator');

router.use(auth, roleCheck('Admin', 'Doctor', 'Nurse', 'Receptionist'));
router.get('/', validators.list, validate, controller.list);
router.patch('/:id/read', validators.notificationId, validate, controller.markRead);

module.exports = router;
