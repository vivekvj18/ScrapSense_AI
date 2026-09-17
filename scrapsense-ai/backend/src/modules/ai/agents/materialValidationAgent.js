export async function runMaterialValidation({ material, demoCase = 'burn' }) {
  if (demoCase === 'mismatch') {
    return { matchScore: 12, status: 'MISMATCH', explanation: 'The simulated image case is not consistent with the registered material.', identityVerified: false };
  }
  return {
    matchScore: 88,
    status: 'MATCH',
    explanation: `The visible product appears consistent with ${material.material_name}, but exact identity is not proven without a visible serial label or reference match.`,
    referenceMaterial: { materialId: material.material_id, productNumber: material.product_number, materialName: material.material_name },
    identityVerified: false
  };
}
