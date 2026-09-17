import express from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { asyncHandler, AppError } from '../../utils/errors.js';
import { query, withTransaction } from '../../database/pool.js';

export const inventoryRouter = express.Router();

inventoryRouter.get('/', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT m.material_id, m.product_number, m.material_name, sb.available_qty, sb.repair_qty, sb.scrapped_qty, m.unit_cost
       FROM materials m JOIN stock_balances sb ON sb.material_id=m.material_id ORDER BY m.material_id`
  );
  res.json({ inventory: result.rows });
}));

inventoryRouter.get('/pending-verification', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT ht.task_id, ht.request_id, ir.material_id, ir.quantity AS approved_quantity, ht.action AS approved_action,
            ht.employee_confirmed_at AS employee_confirmation, ht.status, ri.storage_key AS evidence
       FROM handling_tasks ht
       JOIN inspection_requests ir ON ir.request_id=ht.request_id
       LEFT JOIN request_images ri ON ri.request_id=ir.request_id
      WHERE ht.status='EMPLOYEE_CONFIRMED'
      ORDER BY ht.employee_confirmed_at`
  );
  res.json({ tasks: result.rows });
}));

inventoryRouter.post('/verify/:taskId', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const movement = await withTransaction(async (client) => {
    const existing = await client.query('SELECT * FROM stock_movements WHERE handling_task_id=$1', [req.params.taskId]);
    if (existing.rowCount) return existing.rows[0];

    const task = await client.query(
      `SELECT ht.*, ir.material_id, ir.quantity, ir.final_disposition
         FROM handling_tasks ht
         JOIN inspection_requests ir ON ir.request_id=ht.request_id
        WHERE ht.task_id=$1
        FOR UPDATE OF ht`,
      [req.params.taskId]
    );
    if (!task.rowCount) throw new AppError(404, 'Handling task not found');
    const row = task.rows[0];
    if (row.status !== 'EMPLOYEE_CONFIRMED') throw new AppError(409, 'Employee confirmation is required before verification');
    const stock = await client.query('SELECT * FROM stock_balances WHERE material_id=$1 FOR UPDATE', [row.material_id]);
    if (!stock.rowCount) throw new AppError(404, 'Stock balance not found');
    const before = Number(stock.rows[0].available_qty);
    if (before < Number(row.quantity)) throw new AppError(409, 'Insufficient stock; transaction rolled back');
    const after = before - Number(row.quantity);
    const movementType = row.final_disposition === 'Scrap' ? 'SCRAP' : 'REPAIR_REUSE';
    await client.query(
      `UPDATE stock_balances
          SET available_qty=$2,
              repair_qty=repair_qty + $3,
              scrapped_qty=scrapped_qty + $4,
              updated_at=now()
        WHERE material_id=$1`,
      [row.material_id, after, movementType === 'REPAIR_REUSE' ? row.quantity : 0, movementType === 'SCRAP' ? row.quantity : 0]
    );
    const inserted = await client.query(
      `INSERT INTO stock_movements
       (handling_task_id, request_id, material_id, movement_type, quantity, available_before, available_after, authorized_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [row.task_id, row.request_id, row.material_id, movementType, row.quantity, before, after, req.user.user_id]
    );
    await client.query('UPDATE handling_tasks SET status=$2, manager_verified_at=now(), verified_by=$3 WHERE task_id=$1', [row.task_id, 'COMPLETED', req.user.user_id]);
    await client.query('UPDATE inspection_requests SET status=$2, updated_at=now() WHERE request_id=$1', [row.request_id, 'Completed']);
    await client.query('INSERT INTO audit_events (actor_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)', [
      req.user.user_id, 'INVENTORY_VERIFIED', 'handling_task', row.task_id, { movementType, quantity: row.quantity }
    ]);
    return inserted.rows[0];
  });
  res.json({ movement });
}));

inventoryRouter.get('/movements', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const term = `%${req.query.search || ''}%`;
  const result = await query(
    `SELECT sm.*, u.full_name AS authorized_by_name
       FROM stock_movements sm JOIN users u ON u.user_id=sm.authorized_by
      WHERE sm.material_id ILIKE $1 OR sm.movement_type ILIKE $1
      ORDER BY sm.created_at DESC`,
    [term]
  );
  res.json({ movements: result.rows });
}));
