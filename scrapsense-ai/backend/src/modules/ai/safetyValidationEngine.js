export function applySafetyValidation({ damage, material, reason, compositeScore, rawClassification, exactIdentityRequired = false }) {
  const hardGates = [];
  const warnings = [];

  if (!damage || damage.damageSeverity == null) hardGates.push('Essential damage analysis score is unavailable.');
  if (!material || material.matchScore == null) hardGates.push('Material validation score is unavailable.');
  if (!reason || reason.consistencyScore == null) hardGates.push('Reason consistency score is unavailable.');
  if (material?.status === 'MISMATCH') hardGates.push('Submitted material definitely mismatches the photographed object.');
  if (exactIdentityRequired && !material?.identityVerified) hardGates.push('Exact material identity cannot be established for a material that requires identity verification.');
  if (damage?.criticalDamage) hardGates.push('Critical visible physical damage was detected.');
  if (reason?.status === 'PARTIALLY_CONSISTENT') warnings.push('Reported reason is only partially supported by visible evidence.');
  if (reason?.status === 'INCONSISTENT') warnings.push('Reported reason is not supported by visible evidence.');
  if (material?.status === 'UNCERTAIN') warnings.push('Material match has noncritical uncertainty.');

  return {
    hardGates,
    warnings,
    effectiveRecommendation: hardGates.length ? 'MANUAL_REVIEW_REQUIRED' : rawClassification,
    compositeScore,
    rawClassification
  };
}
