const fs = require('fs');
const path = require('path');
const {
  createHealthRecord,
  getHealthRecordsByUserId,
  getHealthRecordById,
  deleteHealthRecordById,
} = require('../models/healthRecordModel');
const { resolveUploadPath } = require('../middleware/sensitiveUploadAccess');
const logger = require('../utils/logger');

const getPatientId = (req) => req.accessContext?.patientId || req.user?.userId || req.user?.sub;

const buildFileUrl = (_req, file) => {
  const destination = String(file?.destination || '');
  const suffix = destination.split(/uploads[\\/]/).pop();
  const normalizedFolder = String(suffix || 'health-records').replace(/\\/g, '/').replace(/^\/+/, '');
  return `/uploads/${normalizedFolder}/${file.filename}`;
};

const buildFileEndpoint = (recordId) => `/api/health-records/${recordId}/file`;

const sanitizeHealthRecord = (record) => {
  if (!record) {
    return null;
  }

  return {
    ...record,
    file_url: undefined,
    file_endpoint: buildFileEndpoint(record.id),
    has_file: Boolean(record.file_url),
  };
};

const getContentTypeFromExtension = (absolutePath) => {
  const extension = path.extname(String(absolutePath || '')).toLowerCase();

  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';

  return 'application/octet-stream';
};

const resolveRecordContentType = (record, absolutePath) => {
  const storedMimeType = String(record?.mime_type || '').trim();
  return storedMimeType || getContentTypeFromExtension(absolutePath);
};

const buildDownloadName = (record) => {
  const extension = path.extname(String(record?.file_url || '')).toLowerCase();
  const safeTitle = String(record?.title || 'health-record')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${safeTitle || 'health-record'}${extension || ''}`;
};

const createHealthRecordEntry = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'file is required' });
    }

    const { title, record_type, record_date, notes } = req.body;

    const record = await createHealthRecord({
      userId: getPatientId(req),
      title,
      recordType: record_type,
      fileUrl: buildFileUrl(req, req.file),
      recordDate: record_date || null,
      notes: notes || null,
    });

    return res.status(201).json({
      message: 'Health record created successfully',
      record: sanitizeHealthRecord(record),
    });
  } catch (error) {
    logger.error('Health record creation failed', {
      requestId: req.requestId,
      message: error.message,
    });
    return res.status(500).json({
      message: 'Failed to create health record',
      error: error.message,
    });
  }
};

const getHealthRecords = async (req, res) => {
  try {
    const records = await getHealthRecordsByUserId(getPatientId(req));
    return res.status(200).json({ records: records.map(sanitizeHealthRecord) });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch health records',
      error: error.message,
    });
  }
};

const getHealthRecord = async (req, res) => {
  try {
    const record = await getHealthRecordById({
      recordId: req.params.id,
      userId: getPatientId(req),
    });

    if (!record) {
      return res.status(404).json({ message: 'Health record not found' });
    }

    return res.status(200).json({ record: sanitizeHealthRecord(record) });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch health record',
      error: error.message,
    });
  }
};

const streamHealthRecordFile = async (req, res) => {
  try {
    const record = await getHealthRecordById({
      recordId: req.params.id,
      userId: getPatientId(req),
    });

    if (!record) {
      return res.status(404).json({ message: 'Health record not found' });
    }

    const absolutePath = resolveUploadPath({
      fileUrl: record.file_url,
      expectedFolder: 'health-records',
    });

    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'Health record file not found' });
    }

    res.setHeader('Content-Type', resolveRecordContentType(record, absolutePath));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(buildDownloadName(record))}"`);
    res.setHeader('Cache-Control', 'no-store');

    const fileStream = fs.createReadStream(absolutePath);
    fileStream.on('error', (error) => {
      logger.error('Health record file stream failed', {
        requestId: req.requestId,
        message: error.message,
      });

      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to stream health record file' });
        return;
      }

      res.destroy(error);
    });

    fileStream.pipe(res);
    return null;
  } catch (error) {
    logger.error('Health record file access failed', {
      requestId: req.requestId,
      message: error.message,
    });
    return res.status(500).json({
      message: 'Failed to fetch health record file',
    });
  }
};

const deleteHealthRecord = async (req, res) => {
  try {
    const deleted = await deleteHealthRecordById({
      recordId: req.params.id,
      userId: getPatientId(req),
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Health record not found' });
    }

    return res.status(200).json({ message: 'Health record deleted successfully' });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to delete health record',
      error: error.message,
    });
  }
};

module.exports = {
  createHealthRecordEntry,
  getHealthRecords,
  getHealthRecord,
  streamHealthRecordFile,
  deleteHealthRecord,
};
