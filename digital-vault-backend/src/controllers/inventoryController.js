const {
  upsertInventory,
  getInventoryByUserId,
  updateInventoryByMedicineId,
  getLowStockInventoryByUserId,
} = require('../models/inventoryModel');
const { findMedicineForUser } = require('../models/medicineLogModel');

const getPatientId = (req) => req.accessContext?.patientId || req.user?.userId || req.user?.sub;

const createInventory = async (req, res) => {
  try {
    const userId = getPatientId(req);
    const {
      medicine_id,
      quantity_total,
      quantity_remaining,
      refill_threshold,
    } = req.body;

    const medicine = await findMedicineForUser({ medicineId: medicine_id, userId });
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    const inventory = await upsertInventory({
      medicineId: medicine_id,
      userId,
      quantityTotal: quantity_total,
      quantityRemaining: quantity_remaining,
      refillThreshold: refill_threshold,
    });

    return res.status(201).json({
      message: 'Inventory saved successfully',
      inventory,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to save inventory',
      error: error.message,
    });
  }
};

const getInventory = async (req, res) => {
  try {
    const inventory = await getInventoryByUserId(getPatientId(req));
    return res.status(200).json({ inventory });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch inventory',
      error: error.message,
    });
  }
};

const patchInventory = async (req, res) => {
  try {
    const inventory = await updateInventoryByMedicineId({
      medicineId: req.params.medicineId,
      userId: getPatientId(req),
      quantityTotal: req.body.quantity_total,
      quantityRemaining: req.body.quantity_remaining,
      refillThreshold: req.body.refill_threshold,
    });

    if (!inventory) {
      return res.status(404).json({ message: 'Inventory not found' });
    }

    return res.status(200).json({
      message: 'Inventory updated successfully',
      inventory,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update inventory',
      error: error.message,
    });
  }
};

const getLowStockInventory = async (req, res) => {
  try {
    const inventory = await getLowStockInventoryByUserId(getPatientId(req));
    return res.status(200).json({
      low_stock: inventory,
      count: inventory.length,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch low stock inventory',
      error: error.message,
    });
  }
};

module.exports = {
  createInventory,
  getInventory,
  patchInventory,
  getLowStockInventory,
};
