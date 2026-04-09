const errorHandler = (err, req, res, next) => {
  const isMulterError = err?.name === 'MulterError';
  const statusCode = err.statusCode || (isMulterError ? 400 : 500);
  const requestId = req.requestId;

  let message = err.message || 'Internal Server Error';
  if (isMulterError && err.code === 'LIMIT_FILE_SIZE') {
    message = 'File too large. Max size is 10MB';
  }

  // Avoid logging secrets/tokens. Log requestId for correlation.
  // eslint-disable-next-line no-console
  console.error(`[${requestId || 'no-req-id'}]`, message);

  return res.status(statusCode).json({
    success: false,
    message,
    ...(requestId ? { requestId } : {}),
    ...(process.env.NODE_ENV !== 'production' && err.details ? { details: err.details } : {}),
  });
};

module.exports = errorHandler;
