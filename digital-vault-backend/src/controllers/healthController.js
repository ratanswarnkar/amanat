const { getApiStatus } = require('../services/healthService');

const getRootMessage = (req, res) => {
  res.status(200).send(getApiStatus());
};

module.exports = { getRootMessage };
