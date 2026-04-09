const { sendError, sendOk } = require('../utils/http');
const {
  createSchedule,
  listSchedulesByPatientId,
  updateScheduleById,
  deleteScheduleById,
  normalizeTimes,
} = require('../models/scheduleModel');

const VALID_REPEAT_TYPES = new Set(['daily', 'weekly', 'custom']);

const sanitizeText = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
};

const getRequesterId = (req) => req.user?.userId || req.user?.sub || null;
const getPatientId = (req) => req.accessContext?.patientId || getRequesterId(req);

const parseTimes = (rawTimes) => {
  if (!Array.isArray(rawTimes) || rawTimes.length === 0) {
    return [];
  }
  return normalizeTimes(rawTimes);
};

const createScheduleEntry = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    const requesterId = getRequesterId(req);
    const medicineName = sanitizeText(req.body?.medicine_name);
    const dosage = sanitizeText(req.body?.dosage);
    const times = parseTimes(req.body?.time);
    const repeatType = sanitizeText(req.body?.repeat_type || 'daily').toLowerCase();
    const customPattern = Array.isArray(req.body?.custom_pattern) ? req.body.custom_pattern : [];

    if (!patientId || !requesterId) {
      return sendError(res, 401, 'Unauthorized');
    }

    if (!medicineName) {
      return sendError(res, 400, 'medicine_name is required');
    }

    if (times.length === 0) {
      return sendError(res, 400, 'time must contain at least one valid value in HH:MM format');
    }

    if (!VALID_REPEAT_TYPES.has(repeatType)) {
      return sendError(res, 400, 'repeat_type must be one of daily, weekly, custom');
    }

    const schedule = await createSchedule({
      patientId,
      medicineName,
      dosage,
      times,
      repeatType,
      customPattern,
      createdBy: requesterId,
    });

    return sendOk(res, { message: 'Schedule created successfully', schedule }, 201);
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to create schedule');
  }
};

const getSchedules = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    if (!patientId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const schedules = await listSchedulesByPatientId(patientId);
    return sendOk(res, { schedules });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to fetch schedules');
  }
};

const updateScheduleEntry = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    const requesterId = getRequesterId(req);
    const scheduleId = String(req.params?.id || '').trim();
    const medicineNameRaw = req.body?.medicine_name;
    const dosageRaw = req.body?.dosage;
    const timeRaw = req.body?.time;
    const repeatTypeRaw = req.body?.repeat_type;

    if (!patientId || !requesterId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const payload = {
      scheduleId,
      patientId,
      medicineName: medicineNameRaw !== undefined ? sanitizeText(medicineNameRaw) : undefined,
      dosage: dosageRaw !== undefined ? sanitizeText(dosageRaw) : undefined,
      times: timeRaw !== undefined ? parseTimes(timeRaw) : undefined,
      repeatType: repeatTypeRaw !== undefined ? sanitizeText(repeatTypeRaw).toLowerCase() : undefined,
      customPattern: req.body?.custom_pattern,
      updatedBy: requesterId,
    };

    if (medicineNameRaw !== undefined && !payload.medicineName) {
      return sendError(res, 400, 'medicine_name cannot be empty');
    }

    if (payload.repeatType !== undefined && !VALID_REPEAT_TYPES.has(payload.repeatType)) {
      return sendError(res, 400, 'repeat_type must be one of daily, weekly, custom');
    }

    if (timeRaw !== undefined && (!Array.isArray(timeRaw) || payload.times.length === 0)) {
      return sendError(res, 400, 'time must contain at least one valid value in HH:MM format');
    }

    const schedule = await updateScheduleById(payload);
    if (!schedule) {
      return sendError(res, 404, 'Schedule not found');
    }

    return sendOk(res, { message: 'Schedule updated successfully', schedule });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to update schedule');
  }
};

const deleteScheduleEntry = async (req, res) => {
  try {
    const patientId = getPatientId(req);
    const scheduleId = String(req.params?.id || '').trim();

    if (!patientId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const deleted = await deleteScheduleById({ scheduleId, patientId });
    if (!deleted) {
      return sendError(res, 404, 'Schedule not found');
    }

    return sendOk(res, { message: 'Schedule deleted successfully' });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to delete schedule');
  }
};

module.exports = {
  createScheduleEntry,
  getSchedules,
  updateScheduleEntry,
  deleteScheduleEntry,
};
