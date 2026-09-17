import express from 'express';
import path from 'path';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { asyncHandler, AppError } from '../../utils/errors.js';
import { query } from '../../database/pool.js';
import { analyzeRequest } from '../ai/orchestrator.js';

export const requestRouter = express.Router();

async function assertMaterial(materialId, productNumber, quantity) {
  const result = await query(
    `SELECT m.*, sb.available_qty FROM materials m JOIN stock_balances sb ON sb.material_id=m.material_id WHERE m.material_id=$1`,
    [materialId]
  );
  if (!result.rowCount) throw new AppError(400, 'Material ID does not exist');
  const material = result.rows[0];
  if (material.product_number !== productNumber) throw new AppError(400, 'Product number does not match registered material');
  if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) throw new AppError(400, 'Quantity must be positive');
  if (Number(quantity) > Number(material.available_qty)) throw new AppError(400, 'Quantity exceeds available stock');
  return material;
}

requestRouter.post('/', requireAuth, requireRole('EMPLOYEE'), upload.single('image'), asyncHandler(async (req, res) => {
  const { materialId, productNumber, location, quantity, reportedReason, employeeComments, demoCase } = req.body;
  if (!reportedReason) throw new AppError(400, 'Reported reason is required');
  if (!req.file) throw new AppError(400, 'Material image is required');
  await assertMaterial(materialId, productNumber, quantity);
  const requestNumber = `REQ-${Date.now().toString().slice(-8)}`;
  const created = await query(
    `INSERT INTO inspection_requests
       (request_number, employee_id, material_id, quantity, location, reported_reason, employee_comments, status, submitted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
     RETURNING request_id, request_number, status`,
    [requestNumber, req.user.user_id, materialId, Number(quantity), location, reportedReason, employeeComments || '', 'Submitted']
  );
  await query(
    `INSERT INTO request_images (request_id, image_kind, storage_key, mime_type, uploaded_by)
     VALUES ($1,'inspection',$2,$3,$4)`,
    [created.rows[0].request_id, req.file.filename, req.file.mimetype, req.user.user_id]
  );
  await query('INSERT INTO audit_events (actor_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)', [
    req.user.user_id, 'REQUEST_SUBMITTED', 'inspection_request', created.rows[0].request_id, { requestNumber }
  ]);
  analyzeRequest(created.rows[0].request_id, demoCase || 'burn').catch((error) => console.error('AI analysis failed', error));
  res.status(201).json({ request: created.rows[0], message: 'Your inspection request has been submitted successfully.' });
}));

requestRouter.get('/my', requireAuth, requireRole('EMPLOYEE'), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT ir.request_id, ir.request_number, ir.material_id, m.material_name, ir.quantity, ir.reported_reason,
            ir.submitted_at, ir.status, ir.final_disposition, md.decision, md.disposition, md.remarks,
            ht.task_id, ht.action AS handling_action, ht.status AS handling_status,
            ri.storage_key
       FROM inspection_requests ir
       JOIN materials m ON m.material_id=ir.material_id
       LEFT JOIN manager_decisions md ON md.request_id=ir.request_id
       LEFT JOIN handling_tasks ht ON ht.request_id=ir.request_id
       LEFT JOIN request_images ri ON ri.request_id=ir.request_id
      WHERE ir.employee_id=$1
      ORDER BY ir.created_at DESC`,
    [req.user.user_id]
  );
  res.json({ requests: result.rows });
}));

requestRouter.get('/', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT ir.request_id, ir.request_number, u.full_name AS employee, ir.material_id, m.product_number, m.material_name,
            ir.reported_reason, ir.status, ir.submitted_at
       FROM inspection_requests ir
       JOIN users u ON u.user_id=ir.employee_id
       JOIN materials m ON m.material_id=ir.material_id
      ORDER BY ir.created_at DESC`
  );
  res.json({ requests: result.rows });
}));

requestRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const manager = req.user.role === 'MANAGER';
  const params = manager ? [req.params.id] : [req.params.id, req.user.user_id];
  const ownership = manager ? 'ir.request_id=$1' : 'ir.request_id=$1 AND ir.employee_id=$2';
  const result = await query(
    `SELECT ir.*, u.full_name AS employee_name, u.employee_code, m.product_number, m.material_name, ri.storage_key,
            md.decision, md.disposition, md.remarks, ht.task_id, ht.action AS handling_action, ht.status AS handling_status
       FROM inspection_requests ir
       JOIN users u ON u.user_id=ir.employee_id
       JOIN materials m ON m.material_id=ir.material_id
       LEFT JOIN request_images ri ON ri.request_id=ir.request_id
       LEFT JOIN manager_decisions md ON md.request_id=ir.request_id
       LEFT JOIN handling_tasks ht ON ht.request_id=ir.request_id
      WHERE ${ownership}`,
    params
  );
  if (!result.rowCount) throw new AppError(404, 'Request not found');
  res.json({ request: result.rows[0] });
}));

requestRouter.post('/:id/confirm-action', requireAuth, requireRole('EMPLOYEE'), asyncHandler(async (req, res) => {
  const task = await query(
    `UPDATE handling_tasks ht
        SET status='EMPLOYEE_CONFIRMED', employee_confirmed_at=now()
       FROM inspection_requests ir
      WHERE ht.request_id=ir.request_id AND ht.request_id=$1 AND ir.employee_id=$2 AND ht.status='ASSIGNED'
      RETURNING ht.*`,
    [req.params.id, req.user.user_id]
  );
  if (!task.rowCount) throw new AppError(404, 'No assigned handling task found');
  await query('UPDATE inspection_requests SET status=$2, updated_at=now() WHERE request_id=$1', [req.params.id, 'Pending Inventory Verification']);
  await query('INSERT INTO notifications (user_id, message, request_id) SELECT manager_id, $1, request_id FROM manager_decisions WHERE request_id=$2', [
    'Employee confirmed physical handling action.', req.params.id
  ]);
  res.json({ task: task.rows[0] });
}));

requestRouter.get('/image/:filename', requireAuth, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT ir.employee_id FROM request_images ri JOIN inspection_requests ir ON ir.request_id=ri.request_id WHERE ri.storage_key=$1`,
    [req.params.filename]
  );
  if (!result.rowCount) throw new AppError(404, 'Image not found');
  if (req.user.role !== 'MANAGER' && result.rows[0].employee_id !== req.user.user_id) throw new AppError(403, 'Forbidden');
  res.sendFile(path.resolve('uploads', req.params.filename));
}));
