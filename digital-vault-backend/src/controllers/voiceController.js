const { createMedicine } = require('../models/medicineModel');
const { parseVoiceMedicine } = require('../services/voiceMedicineService');

const createMedicineFromVoice = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { voice_text } = req.body;

    const parsed = parseVoiceMedicine(voice_text);
    const medicine = await createMedicine({
      userId,
      name: parsed.name,
      dosage: parsed.dosage,
      timesPerDay: parsed.timesPerDay,
      timeSlots: parsed.timeSlots,
      startDate: null,
      endDate: null,
      notes: parsed.notes,
    });

    return res.status(201).json({
      message: 'Medicine created from voice input',
      parsed,
      medicine,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to create medicine from voice input',
      error: error.message,
    });
  }
};

module.exports = {
  createMedicineFromVoice,
};
