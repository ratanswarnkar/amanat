const makeError = (statusCode, message, details) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (details) err.details = details;
  return err;
};

const sendOk = (res, payload = {}, statusCode = 200) => {
  return res.status(statusCode).json({ success: true, ...payload });
};

const sendError = (res, statusCode, message, details) => {
  return res.status(statusCode).json({ success: false, message, ...(details ? { details } : {}) });
};

module.exports = {
  makeError,
  sendOk,
  sendError,
};

