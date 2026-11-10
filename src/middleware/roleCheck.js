const { failure } = require('../utils/response');

module.exports = (...allowedRoles) => (req, res, next) => {
  const role = req.user?.role?.name;
  if (!role || !allowedRoles.includes(role)) return failure(res, 'You do not have permission to perform this action', 403);
  return next();
};
