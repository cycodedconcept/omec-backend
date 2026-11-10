const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validate');
const validators = require('../validators/auth.validator');
const authRateLimiter = require('../middleware/authRateLimiter');

router.use(authRateLimiter);
router.post('/login', validators.login, validate, controller.login);
router.post('/logout', auth, controller.logout);
router.post('/reset-password', validators.resetPassword, validate, controller.resetPassword);
router.post('/users', auth, roleCheck('Admin'), validators.createUser, validate, controller.createUser);

module.exports = router;
