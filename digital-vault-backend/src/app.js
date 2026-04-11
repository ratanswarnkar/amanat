const express = require('express');
const cors = require('cors');
const path = require('path');
console.log("🔥 app.js loaded");
console.log("🔥 authRoutes loaded");
require('dotenv').config();

const isBackgroundJobsEnabled = String(process.env.DISABLE_BACKGROUND_JOBS || '').toLowerCase() !== 'true';
if (isBackgroundJobsEnabled) {
  require('./jobs/reminderJob');
  require('./jobs/lifeInactivityJob');
}

let helmet;
try {
  helmet = require('helmet');
} catch (_error) {
  helmet = null;
}

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const caretakerRoutes = require('./routes/caretakerRoutes');
const healthRecordRoutes = require('./routes/healthRecordRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const lifeRoutes = require('./routes/lifeRoutes');
const nomineeRoutes = require('./routes/nomineeRoutes');
const nomineeAccessRoutes = require('./routes/nomineeAccessRoutes');
const profileRoutes = require('./routes/profileRoutes');
const userRoutes = require('./routes/userRoutes');
const securityQuestionRoutes = require('./routes/securityQuestionRoutes');
const medicineRoutes = require('./routes/medicineRoutes');
const medicineLogRoutes = require('./routes/medicineLogRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const vitalRoutes = require('./routes/vitalRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const vaultFileRoutes = require('./routes/vaultFileRoutes');
const errorHandler = require('./middleware/errorHandler');
const requestContext = require('./middleware/requestContext');
const { sensitiveUploadAccess } = require('./middleware/sensitiveUploadAccess');
const logger = require('./utils/logger');

const app = express();
app.set('trust proxy', 1);

if (helmet) {
  app.use(helmet());
} else {
  logger.warn('helmet is not installed; security headers are disabled');
}

const envOrigins = String(process.env.ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigins = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  ...envOrigins,
];

const corsOptions = {
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-OTP-Verified-Token'],
  credentials: true,
};

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const isSecure = req.secure || forwardedProto === 'https';
  if (isSecure) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'HTTPS is required',
  });
});

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(requestContext);
app.use(express.json());
app.use(sensitiveUploadAccess);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/', (req, res) => {
  res.status(200).send('API is running...');
});

app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/caretakers', caretakerRoutes);
app.use('/api/health-records', healthRecordRoutes);
app.use('/health-records', healthRecordRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/life', lifeRoutes);
app.use('/api/nominees', nomineeRoutes);
app.use('/api/nominee-access', nomineeAccessRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/user', userRoutes);
app.use('/security-questions', securityQuestionRoutes);
app.use('/api/security-questions', securityQuestionRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/medicines', medicineLogRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/vitals', vitalRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/vault', vaultFileRoutes);
app.use('/api', reminderRoutes);
app.use('/', reminderRoutes);
app.use(errorHandler);

module.exports = app;
