import { query } from '../../database/pool.js';
import { env } from '../../config/env.js';
import { calculateCompositeScore, classifyComposite } from './scoringEngine.js';
import { applySafetyValidation } from './safetyValidationEngine.js';
import { runDamageDetection } from './agents/damageDetectionAgent.js';
import { runMaterialValidation } from './agents/materialValidationAgent.js';
import { runReasonConsistency } from './agents/reasonConsistencyAgent.js';
import { generateSummary } from './reportGenerator.js';

export async function analyzeRequest(requestId, demoCase = 'burn') {
  await query('UPDATE inspection_requests SET status=$2, updated_at=now() WHERE request_id=$1', [requestId, 'AI Analysis in Progress']);
  const loaded = await query(
    `SELECT ir.*, m.product_number, m.material_name, m.material_type_id, mt.inspection_config
       FROM inspection_requests ir
       JOIN materials m ON m.material_id = ir.material_id
       JOIN material_types mt ON mt.material_type_id = m.material_type_id
      WHERE ir.request_id = $1`,
    [requestId]
  );
  const request = loaded.rows[0];
  try {
    const [damage, material] = await Promise.all([
      runDamageDetection({ demoCase, materialType: request.inspection_config }),
      runMaterialValidation({ material: request, demoCase })
    ]);
    const reason = await runReasonConsistency({ reportedReason: request.reported_reason, damage });

    let compositeScore = null;
    let rawClassification = null;
    if ([damage.damageSeverity, material.matchScore, reason.consistencyScore].every((score) => typeof score === 'number')) {
      compositeScore = Number(calculateCompositeScore(damage.damageSeverity, material.matchScore, reason.consistencyScore).toFixed(2));
      rawClassification = classifyComposite(compositeScore);
    }

    const scoring = applySafetyValidation({
      damage,
      material,
      reason,
      compositeScore,
      rawClassification,
      exactIdentityRequired: request.inspection_config?.exactIdentityRequired === true
    });
    const summary = generateSummary({ analysisMode: env.aiMode, damage, material, reason, scoring });
    const version = await query('SELECT COALESCE(max(report_version),0)+1 AS version FROM inspection_reports WHERE request_id=$1', [requestId]);
    const report = await query(
      `INSERT INTO inspection_reports
       (request_id, report_version, analysis_mode, damage_score, material_match_score, reason_consistency_score,
        composite_score, raw_classification, effective_recommendation, damage_analysis, material_validation,
        reason_consistency, hard_gates, warnings, summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        requestId,
        version.rows[0].version,
        env.aiMode,
        damage.damageSeverity,
        material.matchScore,
        reason.consistencyScore,
        compositeScore,
        rawClassification,
        scoring.effectiveRecommendation,
        damage,
        material,
        reason,
        scoring.hardGates,
        scoring.warnings,
        summary
      ]
    );
    for (const finding of damage.detectedDefects || []) {
      await query(
        'INSERT INTO defect_findings (report_id, defect_type, severity, observation, bounding_box) VALUES ($1,$2,$3,$4,$5)',
        [report.rows[0].report_id, finding.type, finding.severity || damage.damageSeverity, finding.observation, finding.boundingBox || null]
      );
    }
    await query('UPDATE inspection_requests SET status=$2, updated_at=now() WHERE request_id=$1', [requestId, 'Pending Manager Review']);
    return report.rows[0];
  } catch (error) {
    await query('UPDATE inspection_requests SET status=$2, updated_at=now() WHERE request_id=$1', [requestId, 'AI Analysis Failed / Manual Inspection Required']);
    throw error;
  }
}
