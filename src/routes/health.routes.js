const router = require('express').Router();

router.get('/', (req, res) => res.status(200).json({
  success: true,
  data: { status: 'ok' },
  error: null,
}));

module.exports = router;
