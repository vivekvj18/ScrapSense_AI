import express from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/errors.js';
import { query } from '../../database/pool.js';

export const analyticsRouter = express.Router();

analyticsRouter.get('/summary', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT
      count(*)::int AS total_requests,
      count(*) FILTER (WHERE status='Pending Manager Review')::int AS pending_approvals,
      count(*) FILTER (WHERE status IN ('Awaiting Material Handling','Pending Inventory Verification','Completed'))::int AS approved_requests,
      count(*) FILTER (WHERE status='Rejected')::int AS rejected_requests,
      count(*) FILTER (WHERE final_disposition='Repair / Reuse')::int AS repair_reuse_candidates,
      COALESCE((SELECT sum(quantity)::int FROM stock_movements WHERE movement_type='SCRAP'),0) AS scrapped_units,
      COALESCE((SELECT sum(sm.quantity * m.unit_cost)::numeric(12,2)
                  FROM stock_movements sm JOIN materials m ON m.material_id=sm.material_id
                 WHERE sm.movement_type='SCRAP'),0) AS estimated_scrap_value
     FROM inspection_requests`
  );
  res.json({ summary: result.rows[0] });
}));

analyticsRouter.get('/trends', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const [classification, reuse, monthly, defects] = await Promise.all([
    query(`SELECT COALESCE(raw_classification,'Unavailable') AS name, count(*)::int AS value FROM inspection_reports GROUP BY 1 ORDER BY 1`),
    query(`SELECT COALESCE(final_disposition,'Pending') AS name, count(*)::int AS value FROM inspection_requests GROUP BY 1 ORDER BY 1`),
    query(`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*)::int AS inspections FROM inspection_requests GROUP BY 1 ORDER BY 1`),
    query(`SELECT defect_type AS name, count(*)::int AS value FROM defect_findings GROUP BY 1 ORDER BY value DESC LIMIT 6`)
  ]);
  res.json({ classification: classification.rows, reuse: reuse.rows, monthly: monthly.rows, defects: defects.rows });
}));

analyticsRouter.get('/insights', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const [commonDefect, scrapMaterial, repair, summary] = await Promise.all([
    query(`SELECT defect_type, count(*)::int AS count FROM defect_findings GROUP BY 1 ORDER BY count DESC LIMIT 1`),
    query(`SELECT m.material_name, COALESCE(sum(sm.quantity),0)::int AS units FROM stock_movements sm JOIN materials m ON m.material_id=sm.material_id WHERE sm.movement_type='SCRAP' GROUP BY 1 ORDER BY units DESC LIMIT 1`),
    query(`SELECT count(*)::int AS count FROM inspection_requests WHERE final_disposition='Repair / Reuse'`),
    query(`SELECT count(*)::int AS count FROM inspection_requests`)
  ]);
  res.json({
    insights: {
      mostCommonDefect: commonDefect.rows[0] || null,
      highestScrapGeneratingMaterial: scrapMaterial.rows[0] || null,
      repairReuseOpportunities: repair.rows[0].count,
      inspectionActivitySummary: summary.rows[0].count,
      estimatedRecoverableValueFormula: 'Repair/reuse quantity multiplied by unit cost after verified movement.'
    }
  });
}));
