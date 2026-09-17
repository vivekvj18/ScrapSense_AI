import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler, AppError } from '../../utils/errors.js';
import { query } from '../../database/pool.js';

export const materialsRouter = express.Router();

materialsRouter.get('/:materialId', requireAuth, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT m.material_id, m.product_number, m.material_name, m.location, m.unit, mt.type_code,
            sb.available_qty
       FROM materials m
       JOIN material_types mt ON mt.material_type_id = m.material_type_id
       JOIN stock_balances sb ON sb.material_id = m.material_id
      WHERE m.material_id = $1`,
    [req.params.materialId]
  );
  if (!result.rowCount) throw new AppError(404, 'Material not found');
  const row = result.rows[0];
  if (req.user.role === 'EMPLOYEE') delete row.unit_cost;
  res.json({ material: row });
}));
