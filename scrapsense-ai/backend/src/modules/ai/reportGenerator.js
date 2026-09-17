export function generateSummary({ analysisMode, damage, material, reason, scoring }) {
  const prefix = analysisMode === 'MOCK' ? 'Simulated AI Analysis - Demo Mode. ' : '';
  return `${prefix}Damage severity ${damage.damageSeverity ?? 'unavailable'}, material validation ${material.status}, reason status ${reason.status}. Effective recommendation: ${scoring.effectiveRecommendation}.`;
}
