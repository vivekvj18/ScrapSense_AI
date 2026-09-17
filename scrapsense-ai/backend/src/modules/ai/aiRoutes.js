import express from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { asyncHandler, AppError } from '../../utils/errors.js';
import { query } from '../../database/pool.js';
import { analyzeRequest } from './orchestrator.js';

export const aiRouter = express.Router();

aiRouter.post('/:requestId/analyze', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  res.json({ report: await analyzeRequest(req.params.requestId, req.body.demoCase || 'burn') });
}));

aiRouter.get('/:requestId/report', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const report = await query(
    `SELECT * FROM inspection_reports WHERE request_id=$1 ORDER BY report_version DESC LIMIT 1`,
    [req.params.requestId]
  );
  if (!report.rowCount) throw new AppError(404, 'Inspection report not found');
  res.json({ report: report.rows[0] });
}));
