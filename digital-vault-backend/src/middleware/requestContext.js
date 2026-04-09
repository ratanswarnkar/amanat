const { randomUUID } = require('crypto');

const requestContext = (req, _res, next) => {
  req.requestId = req.headers['x-request-id'] || randomUUID();
  next();
};

module.exports = requestContext;

