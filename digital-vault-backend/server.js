const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const logger = require('./src/utils/logger');

const envPath = path.resolve(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  logger.warn('Environment file not found', { envPath });
} else {
  logger.info('Using environment file', { envPath });
}

const db = require('./src/config/db');
const { removeInsecureDefaultAdminAccount } = require('./src/services/insecureAdminRemediationService');

const PORT = Number(process.env.PORT || 5050);
const HOST = process.env.HOST || '0.0.0.0';

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection', { message: error?.message });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { message: error?.message });
});

const startServer = async () => {
  try {
    logger.info('Starting Digital Vault backend');
    await db.initializeDatabase();
    await removeInsecureDefaultAdminAccount();

    const app = require('./src/app');

    app.listen(PORT, HOST, () => {
      logger.info('Server running', { host: HOST, port: PORT });
    });
  } catch (error) {
    logger.error('Startup failed', { message: error.message });
    process.exit(1);
  }
};

startServer();
