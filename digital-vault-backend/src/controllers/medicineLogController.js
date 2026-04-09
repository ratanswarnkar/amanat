const {
  getTodayMedicineSchedule,
  findMedicineForUser,
  createMedicineLog,
  updateReminderStatusForSchedule,
  getAdherenceSummaryByUserId,
} = require('../models/medicineLogModel');
const { decrementInventoryForDose } = require('../models/inventoryModel');

const getPatientId = (req) => req.accessContext?.patientId || req.user?.userId || req.user?.sub;

const getTodayMedicines = async (req, res) => {
  try {
    const userId = getPatientId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const schedule = await getTodayMedicineSchedule(userId);
    return res.status(200).json(schedule);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch today schedule',
      error: error.message,
    });
  }
};

const markDoseTaken = async (req, res) => {
  try {
    const userId = getPatientId(req);
    const { medicine_id, scheduled_time } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!medicine_id || !scheduled_time) {
      return res.status(400).json({ message: 'medicine_id and scheduled_time are required' });
    }

    const medicine = await findMedicineForUser({ medicineId: medicine_id, userId });

    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    const log = await createMedicineLog({
      medicineId: medicine_id,
      userId,
      scheduledTime: scheduled_time,
      status: 'taken',
      takenAt: new Date(),
    });

    await updateReminderStatusForSchedule({
      medicineId: medicine_id,
      userId,
      scheduledTime: scheduled_time,
      status: 'taken',
    });

    const inventory = await decrementInventoryForDose({ medicineId: medicine_id, userId });
    const lowStockAlert =
      inventory && Number(inventory.quantity_remaining) < Number(inventory.refill_threshold);

    return res.status(201).json({
      message: 'Dose marked as taken',
      log,
      low_stock_alert: Boolean(lowStockAlert),
      inventory,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to mark dose as taken',
      error: error.message,
    });
  }
};

const markDoseMissed = async (req, res) => {
  try {
    const userId = getPatientId(req);
    const { medicine_id, scheduled_time } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!medicine_id || !scheduled_time) {
      return res.status(400).json({ message: 'medicine_id and scheduled_time are required' });
    }

    const medicine = await findMedicineForUser({ medicineId: medicine_id, userId });

    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    const log = await createMedicineLog({
      medicineId: medicine_id,
      userId,
      scheduledTime: scheduled_time,
      status: 'missed',
      takenAt: null,
    });

    await updateReminderStatusForSchedule({
      medicineId: medicine_id,
      userId,
      scheduledTime: scheduled_time,
      status: 'missed',
    });

    return res.status(201).json({
      message: 'Dose marked as missed',
      log,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to mark dose as missed',
      error: error.message,
    });
  }
};

const getAdherenceSummary = async (req, res) => {
  try {
    const userId = getPatientId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const summary = await getAdherenceSummaryByUserId(userId);
    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch adherence summary',
      error: error.message,
    });
  }
};

module.exports = {
  getTodayMedicines,
  markDoseTaken,
  markDoseMissed,
  getAdherenceSummary,
};
