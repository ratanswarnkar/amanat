const { isApprovedCaretakerForPatient } = require('../models/caretakerModel');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizePatientId = (req, fallbackUserId) => {
  const bodyPatientId = req.body?.patient_id;
  if (typeof bodyPatientId === 'string' && bodyPatientId.trim()) {
    return bodyPatientId.trim();
  }

  const queryPatientId = req.query?.patient_id;
  if (typeof queryPatientId === 'string' && queryPatientId.trim()) {
    return queryPatientId.trim();
  }

  const headerPatientId = req.headers['x-patient-id'];
  if (typeof headerPatientId === 'string' && headerPatientId.trim()) {
    return headerPatientId.trim();
  }

  return String(fallbackUserId || '').trim();
};

const checkCaretakerAccess = async (req, res, next) => {
  try {
    const requesterUserId = req.user?.userId || req.user?.sub;
    if (!requesterUserId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const patientId = normalizePatientId(req, requesterUserId);
    if (!UUID_REGEX.test(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid patient_id is required',
      });
    }

    if (String(patientId) === String(requesterUserId)) {
      req.accessContext = {
        patientId,
        actingAs: 'owner',
      };
      return next();
    }

    const hasAccess = await isApprovedCaretakerForPatient({
      caretakerUserId: requesterUserId,
      patientUserId: patientId,
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    req.accessContext = {
      patientId,
      actingAs: 'caretaker',
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to validate caretaker access',
    });
  }
};

module.exports = checkCaretakerAccess;
