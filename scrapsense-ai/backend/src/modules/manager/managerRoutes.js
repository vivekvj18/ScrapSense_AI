import express from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { asyncHandler, AppError } from '../../utils/errors.js';
import { query } from '../../database/pool.js';

export const managerRouter = express.Router();

managerRouter.post('/requests/:id/decision', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const { decision, disposition, remarks = '', overrideReason = '' } = req.body;
  const allowedDecisions = ['Approve', 'Reject', 'Request Additional Information'];
  const allowedDispositions = ['Continue Use', 'Repair / Reuse', 'Scrap', 'Manual Inspection Required'];
  if (!allowedDecisions.includes(decision)) throw new AppError(400, 'Invalid decision');
  if (decision === 'Approve' && !allowedDispositions.includes(disposition)) throw new AppError(400, 'Invalid disposition');
  if ((decision !== 'Approve' || overrideReason) && !remarks.trim()) throw new AppError(400, 'Remarks are required for rejection, additional information, or overrides');

  const report = await query('SELECT report_id, effective_recommendation FROM inspection_reports WHERE request_id=$1 ORDER BY report_version DESC LIMIT 1', [req.params.id]);
  if (!report.rowCount) throw new AppError(400, 'AI report is required before decision');
  const inserted = await query(
    `INSERT INTO manager_decisions (request_id, report_id, manager_id, decision, disposition, remarks, override_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (request_id) DO UPDATE SET report_id=EXCLUDED.report_id, manager_id=EXCLUDED.manager_id, decision=EXCLUDED.decision,
       disposition=EXCLUDED.disposition, remarks=EXCLUDED.remarks, override_reason=EXCLUDED.override_reason, created_at=now()
     RETURNING *`,
    [req.params.id, report.rows[0].report_id, req.user.user_id, decision, disposition || null, remarks, overrideReason]
  );

  let status = decision === 'Approve' ? (disposition === 'Continue Use' ? 'Completed' : 'Awaiting Material Handling') : decision === 'Reject' ? 'Rejected' : 'Additional Information Required';
  await query('UPDATE inspection_requests SET status=$2, final_disposition=$3, updated_at=now() WHERE request_id=$1', [req.params.id, status, disposition || null]);
  if (decision === 'Approve' && disposition !== 'Continue Use') {
    const action = disposition === 'Scrap' ? 'REMOVE_FROM_ACTIVE_INVENTORY' : 'TRANSFER_TO_REPAIR_REUSE';
    await query(
      `INSERT INTO handling_tasks (request_id, action, status) VALUES ($1,$2,'ASSIGNED')
       ON CONFLICT (request_id) DO UPDATE SET action=EXCLUDED.action, status='ASSIGNED'
       RETURNING *`,
      [req.params.id, action]
    );
  }
  await query('INSERT INTO notifications (user_id, message, request_id) SELECT employee_id, $1, request_id FROM inspection_requests WHERE request_id=$2', [
    decision === 'Approve' ? 'Your inspection request has been approved.' : decision === 'Reject' ? 'Your inspection request has been rejected.' : 'Your manager has requested additional information.',
    req.params.id
  ]);
  await query('INSERT INTO audit_events (actor_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5)', [
    req.user.user_id, 'MANAGER_DECISION', 'inspection_request', req.params.id, { decision, disposition }
  ]);
  res.json({ decision: inserted.rows[0] });
}));
