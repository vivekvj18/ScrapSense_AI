import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCompositeScore, classifyComposite } from '../src/modules/ai/scoringEngine.js';
import { applySafetyValidation } from '../src/modules/ai/safetyValidationEngine.js';

test('weighted scoring formula uses 50/20/30 risk conversion', () => {
  assert.equal(calculateCompositeScore(95, 100, 100), 47.5);
});

test('classification thresholds', () => {
  assert.equal(classifyComposite(29.99), 'USABLE_CANDIDATE');
  assert.equal(classifyComposite(30), 'REPAIR_REUSE_CANDIDATE');
  assert.equal(classifyComposite(80), 'REPAIR_REUSE_CANDIDATE');
  assert.equal(classifyComposite(80.01), 'SCRAP_RECOMMENDED');
});

test('missing agent scores trigger manual review gate', () => {
  const result = applySafetyValidation({
    damage: { damageSeverity: 20 },
    material: { matchScore: null, status: 'UNCERTAIN' },
    reason: { consistencyScore: 90 },
    compositeScore: null,
    rawClassification: null
  });
  assert.equal(result.effectiveRecommendation, 'MANUAL_REVIEW_REQUIRED');
  assert.ok(result.hardGates.some((gate) => gate.includes('Material validation')));
});

test('material mismatch and critical damage hard gates', () => {
  const result = applySafetyValidation({
    damage: { damageSeverity: 90, criticalDamage: true },
    material: { matchScore: 10, status: 'MISMATCH' },
    reason: { consistencyScore: 90, status: 'CONSISTENT' },
    compositeScore: 50,
    rawClassification: 'REPAIR_REUSE_CANDIDATE'
  });
  assert.equal(result.effectiveRecommendation, 'MANUAL_REVIEW_REQUIRED');
  assert.equal(result.hardGates.length, 2);
});

test('reason inconsistency creates warning', () => {
  const result = applySafetyValidation({
    damage: { damageSeverity: 20, criticalDamage: false },
    material: { matchScore: 90, status: 'MATCH' },
    reason: { consistencyScore: 55, status: 'INCONSISTENT' },
    compositeScore: 30,
    rawClassification: 'REPAIR_REUSE_CANDIDATE'
  });
  assert.equal(result.effectiveRecommendation, 'REPAIR_REUSE_CANDIDATE');
  assert.ok(result.warnings.length);
});
