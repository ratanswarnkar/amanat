const { createVital, getVitalsByUserId } = require('../models/vitalModel');

const getPatientId = (req) => req.accessContext?.patientId || req.user?.userId || req.user?.sub;

const createVitalEntry = async (req, res) => {
  try {
    const vital = await createVital({
      userId: getPatientId(req),
      type: req.body.type,
      value: req.body.value,
      unit: req.body.unit,
      recordedAt: req.body.recorded_at,
    });

    return res.status(201).json({
      message: 'Vital recorded successfully',
      vital,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to record vital',
      error: error.message,
    });
  }
};

const getVitals = async (req, res) => {
  try {
    const vitals = await getVitalsByUserId(getPatientId(req));
    return res.status(200).json({ vitals });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch vitals',
      error: error.message,
    });
  }
};

module.exports = {
  createVitalEntry,
  getVitals,
};
