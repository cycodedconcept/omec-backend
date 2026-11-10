const success = (res, data, status = 200) => res.status(status).json({
  success: true,
  data,
  error: null,
});

const failure = (res, error, status = 400) => res.status(status).json({
  success: false,
  data: null,
  error,
});

module.exports = { success, failure };
