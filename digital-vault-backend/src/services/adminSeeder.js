const logger = require('../utils/logger');

const seedDefaultAdminUser = async () => {
  logger.warn('Default admin seeding is disabled. Use the guarded admin bootstrap flow instead.');
};

module.exports = {
  seedDefaultAdminUser,
};
