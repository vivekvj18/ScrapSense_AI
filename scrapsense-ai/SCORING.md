# Scoring

ScrapSense AI uses three agent parameters:

- Damage Detection, 50%
- Material Validation, 20%
- Reason Consistency, 30%

Scores range from 0 to 100.

- Higher damage score means more severe visible damage.
- Higher material match score means stronger match evidence.
- Higher reason consistency score means stronger evidence for the stated reason.

Material match and reason consistency are converted into risk values:

```js
damage * 0.50 + (100 - materialMatch) * 0.20 + (100 - reasonConsistency) * 0.30
```

## Thresholds

- Below 30: `USABLE_CANDIDATE`
- 30 through 80: `REPAIR_REUSE_CANDIDATE`
- Above 80: `SCRAP_RECOMMENDED`

The raw weighted classification is stored separately from the effective recommendation.

## Hard Gates

The effective recommendation becomes `MANUAL_REVIEW_REQUIRED` when:

- Material definitely mismatches.
- Exact material identity is required but cannot be established.
- Critical physical damage is detected.
- Required evidence is missing.
- An essential agent result is unavailable.

## Warnings

Warnings are generated for:

- Minor reason inconsistency.
- Noncritical uncertainty.
- Low-quality but usable evidence.

Warnings do not automatically override the provisional classification.

## Mathematical Limitation

The composite risk score is not pure physical damage severity. For example, if damage severity is 95 and both match scores are 100, the score is 47.5. This is a known limitation of the mandated weighted formula. The score weights are prototype configuration, not scientifically validated industrial inspection weights.
