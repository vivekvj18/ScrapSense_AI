export function assertScore(name, value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 100) {
    throw new Error(`${name} must be a number from 0 to 100`);
  }
}

export function calculateCompositeScore(damage, materialMatch, reasonConsistency) {
  assertScore('damage', damage);
  assertScore('materialMatch', materialMatch);
  assertScore('reasonConsistency', reasonConsistency);
  return damage * 0.5 + (100 - materialMatch) * 0.2 + (100 - reasonConsistency) * 0.3;
}

export function classifyComposite(score) {
  assertScore('compositeScore', score);
  if (score < 30) return 'USABLE_CANDIDATE';
  if (score <= 80) return 'REPAIR_REUSE_CANDIDATE';
  return 'SCRAP_RECOMMENDED';
}
