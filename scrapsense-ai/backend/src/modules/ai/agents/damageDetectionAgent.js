export async function runDamageDetection({ demoCase = 'burn' }) {
  const cases = {
    burn: {
      damageSeverity: 92,
      detectedDefects: [{ type: 'burn_mark', observation: 'Visible darkened region near a component area.', critical: true, severity: 92 }],
      criticalDamage: true,
      explanation: 'Severe visible burn-like damage is present. Electrical functionality cannot be verified from the image.',
      limitations: ['Electrical behavior and hidden layer failures cannot be verified from this photograph.']
    },
    scratch: {
      damageSeverity: 38,
      detectedDefects: [{ type: 'surface_scratch', observation: 'Visible superficial surface scratching.', critical: false, severity: 38 }],
      criticalDamage: false,
      explanation: 'Visible damage appears localized and noncritical in this simulated demonstration case.',
      limitations: ['The image cannot prove whether traces or components function correctly.']
    },
    clean: {
      damageSeverity: 10,
      detectedDefects: [],
      criticalDamage: false,
      explanation: 'No obvious visible defect is represented in this simulated demonstration case.',
      limitations: ['Only visible external condition is represented.']
    }
  };
  return cases[demoCase] || cases.burn;
}
