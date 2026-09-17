export async function runReasonConsistency({ reportedReason, damage }) {
  const reason = String(reportedReason || '').toLowerCase();
  const defectText = JSON.stringify(damage.detectedDefects || []).toLowerCase();
  if (reason.includes('internal') || reason.includes('electrical failure')) {
    return { consistencyScore: null, status: 'CANNOT_VERIFY', explanation: 'The reported issue cannot be verified from visible image evidence.', unsupportedClaims: [reportedReason] };
  }
  if ((reason.includes('burn') || reason.includes('black')) && defectText.includes('burn')) {
    return { consistencyScore: 94, status: 'CONSISTENT', explanation: 'The reported burn damage is supported by the visible findings.', unsupportedClaims: [] };
  }
  if (damage.detectedDefects?.length) {
    return { consistencyScore: 62, status: 'PARTIALLY_CONSISTENT', explanation: 'The image shows visible damage, but not every part of the stated reason is directly supported.', unsupportedClaims: [] };
  }
  return { consistencyScore: 80, status: 'CONSISTENT', explanation: 'No obvious contradiction appears between the reason and visible evidence.', unsupportedClaims: [] };
}
