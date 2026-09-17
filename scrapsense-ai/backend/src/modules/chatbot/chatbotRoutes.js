import express from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/errors.js';
import { query } from '../../database/pool.js';

export const chatbotRouter = express.Router();

chatbotRouter.post('/', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const question = String(req.body.question || '').toLowerCase();
  let answer = 'I can help with inspected counts, scrapped units, repair or reuse counts, scrap value, common defects, and pending requests.';
  if (question.includes('inspected')) {
    const r = await query('SELECT count(*)::int AS count FROM inspection_requests');
    answer = `${r.rows[0].count} products have been submitted for inspection.`;
  } else if (question.includes('scrap value')) {
    const r = await query(`SELECT COALESCE(sum(sm.quantity*m.unit_cost),0)::numeric(12,2) AS value FROM stock_movements sm JOIN materials m ON m.material_id=sm.material_id WHERE sm.movement_type='SCRAP'`);
    answer = `Estimated scrap value is ${r.rows[0].value}. Formula: verified scrapped quantity multiplied by material unit cost.`;
  } else if (question.includes('scrap')) {
    const r = await query(`SELECT COALESCE(sum(quantity),0)::int AS count FROM stock_movements WHERE movement_type='SCRAP'`);
    answer = `${r.rows[0].count} units have been verified as scrapped.`;
  } else if (question.includes('repair') || question.includes('reuse')) {
    const r = await query(`SELECT COALESCE(sum(quantity),0)::int AS count FROM stock_movements WHERE movement_type='REPAIR_REUSE'`);
    answer = `${r.rows[0].count} units have been verified for repair or reuse.`;
  } else if (question.includes('defect')) {
    const r = await query(`SELECT defect_type, count(*)::int AS count FROM defect_findings GROUP BY 1 ORDER BY count DESC LIMIT 1`);
    answer = r.rowCount ? `The most common defect is ${r.rows[0].defect_type} with ${r.rows[0].count} finding(s).` : 'No defect findings are available yet.';
  } else if (question.includes('pending')) {
    const r = await query(`SELECT count(*)::int AS count FROM inspection_requests WHERE status='Pending Manager Review'`);
    answer = `${r.rows[0].count} inspection request(s) are pending manager review.`;
  }
  res.json({ answer });
}));
