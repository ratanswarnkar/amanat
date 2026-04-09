const pool = require('../config/db');

const upsertInventory = async ({
  medicineId,
  userId,
  quantityTotal,
  quantityRemaining,
  refillThreshold,
}) => {
  const { rows } = await pool.query(
    `
      INSERT INTO medicine_inventory (
        medicine_id,
        user_id,
        quantity_total,
        quantity_remaining,
        refill_threshold,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (medicine_id, user_id)
      DO UPDATE SET
        quantity_total = EXCLUDED.quantity_total,
        quantity_remaining = EXCLUDED.quantity_remaining,
        refill_threshold = EXCLUDED.refill_threshold,
        updated_at = NOW()
      RETURNING *
    `,
    [medicineId, userId, quantityTotal, quantityRemaining, refillThreshold]
  );

  return rows[0];
};

const getInventoryByUserId = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT i.*, m.name AS medicine_name
      FROM medicine_inventory i
      JOIN medicines m ON m.id = i.medicine_id
      WHERE i.user_id = $1
      ORDER BY i.updated_at DESC
    `,
    [userId]
  );

  return rows;
};

const getInventoryByMedicineId = async ({ medicineId, userId }) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM medicine_inventory
      WHERE medicine_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [medicineId, userId]
  );

  return rows[0] || null;
};

const updateInventoryByMedicineId = async ({
  medicineId,
  userId,
  quantityTotal,
  quantityRemaining,
  refillThreshold,
}) => {
  const { rows } = await pool.query(
    `
      UPDATE medicine_inventory
      SET
        quantity_total = COALESCE($1, quantity_total),
        quantity_remaining = COALESCE($2, quantity_remaining),
        refill_threshold = COALESCE($3, refill_threshold),
        updated_at = NOW()
      WHERE medicine_id = $4 AND user_id = $5
      RETURNING *
    `,
    [quantityTotal ?? null, quantityRemaining ?? null, refillThreshold ?? null, medicineId, userId]
  );

  return rows[0] || null;
};

const decrementInventoryForDose = async ({ medicineId, userId }) => {
  const { rows } = await pool.query(
    `
      UPDATE medicine_inventory
      SET
        quantity_remaining = GREATEST(quantity_remaining - 1, 0),
        updated_at = NOW()
      WHERE medicine_id = $1 AND user_id = $2
      RETURNING *
    `,
    [medicineId, userId]
  );

  return rows[0] || null;
};

const getLowStockInventoryByUserId = async (userId) => {
  const { rows } = await pool.query(
    `
      SELECT i.*, m.name AS medicine_name
      FROM medicine_inventory i
      JOIN medicines m ON m.id = i.medicine_id
      WHERE i.user_id = $1
        AND i.quantity_remaining < i.refill_threshold
      ORDER BY i.updated_at DESC
    `,
    [userId]
  );

  return rows;
};

module.exports = {
  upsertInventory,
  getInventoryByUserId,
  getInventoryByMedicineId,
  updateInventoryByMedicineId,
  decrementInventoryForDose,
  getLowStockInventoryByUserId,
};
