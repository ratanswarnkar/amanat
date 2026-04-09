const { sendError, sendOk } = require('../utils/http');
const { getApprovedCaretakerPatients } = require('../models/caretakerModel');

const getUserId = (req) => req.user?.userId || req.user?.sub;

const getUserRoles = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const caretakerOf = await getApprovedCaretakerPatients({
      caretakerUserId: userId,
    });

    return sendOk(res, {
      isOwner: true,
      caretakerOf: caretakerOf.map((item) => ({
        patient_id: item.patient_id,
        patient_name: item.patient_name,
        status: item.status,
      })),
    });
  } catch (error) {
    return sendError(res, 500, error.message || 'Failed to fetch user roles');
  }
};

module.exports = {
  getUserRoles,
};
