const {
  createMedicine,
  getMedicinesByUserId,
  updateMedicineById,
  deleteMedicineById,
} = require('../models/medicineModel');

const getPatientId = (req) => req.accessContext?.patientId || req.user?.userId || req.user?.sub;

const createMedicineSchedule = async (req, res) => {
  try {
    const userId = getPatientId(req);
    const {
      name,
      dosage,
      times_per_day,
      time_slots,
      start_date,
      end_date,
      notes,
    } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }

    if (time_slots && !Array.isArray(time_slots)) {
      return res.status(400).json({ message: 'time_slots must be an array' });
    }

    const medicine = await createMedicine({
      userId,
      name: name.trim(),
      dosage,
      timesPerDay: times_per_day,
      timeSlots: time_slots,
      startDate: start_date,
      endDate: end_date,
      notes,
    });

    return res.status(201).json({
      message: 'Medicine created successfully',
      medicine,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to create medicine',
      error: error.message,
    });
  }
};

const getMyMedicines = async (req, res) => {
  try {
    const userId = getPatientId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const medicines = await getMedicinesByUserId(userId);

    return res.status(200).json({
      message: 'Medicines fetched successfully',
      medicines,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch medicines',
      error: error.message,
    });
  }
};

const updateMedicine = async (req, res) => {
  try {
    const userId = getPatientId(req);
    const { id } = req.params;
    const {
      name,
      dosage,
      times_per_day,
      time_slots,
      start_date,
      end_date,
      notes,
    } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (time_slots && !Array.isArray(time_slots)) {
      return res.status(400).json({ message: 'time_slots must be an array' });
    }

    const updatedMedicine = await updateMedicineById({
      medicineId: id,
      userId,
      name: name?.trim ? name.trim() : name,
      dosage,
      timesPerDay: times_per_day,
      timeSlots: time_slots,
      startDate: start_date,
      endDate: end_date,
      notes,
    });

    if (!updatedMedicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    return res.status(200).json({
      message: 'Medicine updated successfully',
      medicine: updatedMedicine,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update medicine',
      error: error.message,
    });
  }
};

const deleteMedicine = async (req, res) => {
  try {
    const userId = getPatientId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const deleted = await deleteMedicineById({ medicineId: id, userId });

    if (!deleted) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    return res.status(200).json({
      message: 'Medicine deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to delete medicine',
      error: error.message,
    });
  }
};

module.exports = {
  createMedicineSchedule,
  getMyMedicines,
  updateMedicine,
  deleteMedicine,
};
