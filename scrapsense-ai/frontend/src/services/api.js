const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';

export function getToken() {
  return sessionStorage.getItem('scrapsense_token');
}

export function setSession(token, user) {
  sessionStorage.setItem('scrapsense_token', token);
  sessionStorage.setItem('scrapsense_user', JSON.stringify(user));
}

export function getUser() {
  return JSON.parse(sessionStorage.getItem('scrapsense_user') || 'null');
}

export function clearSession() {
  sessionStorage.removeItem('scrapsense_token');
  sessionStorage.removeItem('scrapsense_user');
}

export async function api(path, options = {}) {
  if (USE_MOCK) return mockApi(path, options);
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (getToken()) headers.set('Authorization', `Bearer ${getToken()}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'Request failed');
  return data;
}

export function imageUrl(storageKey) {
  if (String(storageKey || '').startsWith('data:')) return storageKey;
  return `${API_BASE}/requests/image/${storageKey}?token=${encodeURIComponent(getToken() || '')}`;
}

export function resetMockDemoData() {
  localStorage.removeItem('scrapsense_mock_db');
  sessionStorage.removeItem('scrapsense_token');
  sessionStorage.removeItem('scrapsense_user');
}

const users = [
  { user_id: 'emp-100', employee_code: 'EMP-100', full_name: 'Anika Patel', email: 'employee@scrapsense.local', role: 'EMPLOYEE', password: 'employee123' },
  { user_id: 'mgr-100', employee_code: 'MGR-100', full_name: 'Rohan Mehta', email: 'manager@scrapsense.local', role: 'MANAGER', password: 'manager123' }
];

const materials = [
  { material_id: 'MAT-1001', product_number: 'PCB-A101', material_name: 'Industrial Control PCB', location: 'Warehouse A', unit: 'unit', unit_cost: 42.5, available_qty: 25, repair_qty: 0, scrapped_qty: 0, type_code: 'PCB' },
  { material_id: 'MAT-1002', product_number: 'PCB-B204', material_name: 'Power Regulation PCB', location: 'Warehouse B', unit: 'unit', unit_cost: 55, available_qty: 12, repair_qty: 0, scrapped_qty: 0, type_code: 'PCB' }
];

function db() {
  const existing = JSON.parse(localStorage.getItem('scrapsense_mock_db') || 'null');
  if (existing) return existing;
  const seeded = { requests: [], reports: [], decisions: [], tasks: [], movements: [], notifications: [], inventory: materials };
  localStorage.setItem('scrapsense_mock_db', JSON.stringify(seeded));
  return seeded;
}

function save(next) {
  localStorage.setItem('scrapsense_mock_db', JSON.stringify(next));
}

function currentUser() {
  return getUser();
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function ok(payload) {
  return Promise.resolve(payload);
}

function fail(message) {
  return Promise.reject(new Error(message));
}

function buildReport(request, demoCase) {
  const damageCases = {
    burn: { damageSeverity: 92, criticalDamage: true, detectedDefects: [{ type: 'burn_mark', observation: 'Visible darkened region near a component area.', critical: true, severity: 92 }], explanation: 'Severe visible burn-like damage is present. Electrical functionality cannot be verified from the image.', limitations: ['Electrical behavior and hidden layer failures cannot be verified from this photograph.'] },
    scratch: { damageSeverity: 38, criticalDamage: false, detectedDefects: [{ type: 'surface_scratch', observation: 'Visible superficial surface scratching.', critical: false, severity: 38 }], explanation: 'Visible damage appears localized and noncritical in this simulated demonstration case.', limitations: ['The image cannot prove whether traces or components function correctly.'] },
    clean: { damageSeverity: 10, criticalDamage: false, detectedDefects: [], explanation: 'No obvious visible defect is represented in this simulated demonstration case.', limitations: ['Only visible external condition is represented.'] },
    mismatch: { damageSeverity: 25, criticalDamage: false, detectedDefects: [], explanation: 'The submitted image is represented as a material mismatch demo case.', limitations: ['Exact identity cannot be established from a generic image.'] }
  };
  const damage = damageCases[demoCase] || damageCases.burn;
  const material = demoCase === 'mismatch'
    ? { matchScore: 12, status: 'MISMATCH', explanation: 'The simulated image case is not consistent with the registered material.', identityVerified: false }
    : { matchScore: 88, status: 'MATCH', explanation: `The visible product appears consistent with ${request.material_name}, but exact identity is not proven without a visible serial label.`, identityVerified: false };
  const reason = String(request.reported_reason || '').toLowerCase().includes('internal')
    ? { consistencyScore: null, status: 'CANNOT_VERIFY', explanation: 'The reported issue cannot be verified from visible image evidence.', unsupportedClaims: [request.reported_reason] }
    : damage.detectedDefects.length
      ? { consistencyScore: 94, status: 'CONSISTENT', explanation: 'The reported issue is supported by visible findings.', unsupportedClaims: [] }
      : { consistencyScore: 80, status: 'CONSISTENT', explanation: 'No obvious contradiction appears between the reason and visible evidence.', unsupportedClaims: [] };
  const scores = [damage.damageSeverity, material.matchScore, reason.consistencyScore];
  const composite = scores.every((s) => typeof s === 'number')
    ? Number((damage.damageSeverity * 0.5 + (100 - material.matchScore) * 0.2 + (100 - reason.consistencyScore) * 0.3).toFixed(2))
    : null;
  const raw = composite == null ? null : composite < 30 ? 'USABLE_CANDIDATE' : composite <= 80 ? 'REPAIR_REUSE_CANDIDATE' : 'SCRAP_RECOMMENDED';
  const hard_gates = [];
  const warnings = [];
  if (material.status === 'MISMATCH') hard_gates.push('Submitted material definitely mismatches the photographed object.');
  if (damage.criticalDamage) hard_gates.push('Critical visible physical damage was detected.');
  if (reason.consistencyScore == null) hard_gates.push('Reason consistency score is unavailable.');
  if (material.status === 'UNCERTAIN') warnings.push('Material match has noncritical uncertainty.');
  return {
    report_id: uid('rep'),
    request_id: request.request_id,
    report_version: 1,
    analysis_mode: 'MOCK',
    damage_score: damage.damageSeverity,
    material_match_score: material.matchScore,
    reason_consistency_score: reason.consistencyScore,
    composite_score: composite,
    raw_classification: raw,
    effective_recommendation: hard_gates.length ? 'MANUAL_REVIEW_REQUIRED' : raw,
    damage_analysis: damage,
    material_validation: material,
    reason_consistency: reason,
    hard_gates,
    warnings,
    summary: `Simulated AI Analysis - Demo Mode. Damage severity ${damage.damageSeverity}, material validation ${material.status}, reason status ${reason.status}.`
  };
}

function readFileAsDataUrl(file) {
  if (!file) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function mockApi(path, options = {}) {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const store = db();
  const user = currentUser();

  if (path === '/auth/login' && options.method === 'POST') {
    const body = JSON.parse(options.body);
    const found = users.find((u) => (u.email === body.identifier || u.employee_code === body.identifier) && u.password === body.password);
    if (!found) return fail('Invalid credentials');
    const { password, ...safe } = found;
    return ok({ token: `mock-token-${safe.user_id}`, user: safe });
  }
  if (path === '/auth/me') return ok({ user });
  if (!user) return fail('Authentication required');

  const materialMatch = path.match(/^\/materials\/(.+)$/);
  if (materialMatch) {
    const material = store.inventory.find((m) => m.material_id === materialMatch[1]);
    if (!material) return fail('Material not found');
    const safe = user.role === 'MANAGER' ? material : { ...material, unit_cost: undefined, repair_qty: undefined, scrapped_qty: undefined };
    return ok({ material: safe });
  }

  if (path === '/requests' && options.method === 'POST') {
    const form = options.body;
    const material = store.inventory.find((m) => m.material_id === form.get('materialId'));
    if (!material) return fail('Material ID does not exist');
    if (material.product_number !== form.get('productNumber')) return fail('Product number does not match registered material');
    const quantity = Number(form.get('quantity'));
    if (!quantity || quantity < 1) return fail('Quantity must be positive');
    if (quantity > material.available_qty) return fail('Quantity exceeds available stock');
    const image = await readFileAsDataUrl(form.get('image'));
    const request = {
      request_id: uid('req'),
      request_number: `REQ-${Date.now().toString().slice(-8)}`,
      employee_id: user.user_id,
      employee_name: user.full_name,
      employee_code: user.employee_code,
      material_id: material.material_id,
      product_number: material.product_number,
      material_name: material.material_name,
      location: form.get('location'),
      quantity,
      reported_reason: form.get('reportedReason'),
      employee_comments: form.get('employeeComments'),
      status: 'Pending Manager Review',
      submitted_at: new Date().toISOString(),
      storage_key: image,
      final_disposition: null
    };
    const report = buildReport(request, form.get('demoCase'));
    store.requests.unshift(request);
    store.reports.unshift(report);
    save(store);
    return ok({ request, message: 'Your inspection request has been submitted successfully.' });
  }

  if (path === '/requests/my') {
    return ok({ requests: store.requests.filter((r) => r.employee_id === user.user_id).map((r) => ({ ...r, ...(store.decisions.find((d) => d.request_id === r.request_id) || {}), ...(store.tasks.find((t) => t.request_id === r.request_id) || {}) })) });
  }
  if (path === '/requests' && !options.method) return ok({ requests: store.requests });

  const requestDetail = path.match(/^\/requests\/([^/]+)$/);
  if (requestDetail && !options.method) {
    const request = store.requests.find((r) => r.request_id === requestDetail[1]);
    if (!request) return fail('Request not found');
    return ok({ request: { ...request, ...(store.decisions.find((d) => d.request_id === request.request_id) || {}), ...(store.tasks.find((t) => t.request_id === request.request_id) || {}) } });
  }

  const reportMatch = path.match(/^\/inspections\/([^/]+)\/report$/);
  if (reportMatch) {
    const report = store.reports.find((r) => r.request_id === reportMatch[1]);
    if (!report) return fail('Inspection report not found');
    return ok({ report });
  }

  const decisionMatch = path.match(/^\/requests\/([^/]+)\/decision$/);
  if (decisionMatch && options.method === 'POST') {
    const body = JSON.parse(options.body);
    const request = store.requests.find((r) => r.request_id === decisionMatch[1]);
    if (!request) return fail('Request not found');
    const decision = { decision_id: uid('dec'), request_id: request.request_id, manager_id: user.user_id, created_at: new Date().toISOString(), ...body };
    store.decisions = store.decisions.filter((d) => d.request_id !== request.request_id);
    store.decisions.unshift(decision);
    request.status = body.decision === 'Approve' ? (body.disposition === 'Continue Use' ? 'Completed' : 'Awaiting Material Handling') : body.decision === 'Reject' ? 'Rejected' : 'Additional Information Required';
    request.final_disposition = body.disposition;
    if (body.decision === 'Approve' && body.disposition !== 'Continue Use') {
      store.tasks = store.tasks.filter((t) => t.request_id !== request.request_id);
      store.tasks.unshift({ task_id: uid('task'), request_id: request.request_id, action: body.disposition === 'Scrap' ? 'REMOVE_FROM_ACTIVE_INVENTORY' : 'TRANSFER_TO_REPAIR_REUSE', handling_action: body.disposition === 'Scrap' ? 'REMOVE_FROM_ACTIVE_INVENTORY' : 'TRANSFER_TO_REPAIR_REUSE', status: 'ASSIGNED', handling_status: 'ASSIGNED' });
    }
    store.notifications.unshift({ notification_id: uid('note'), user_id: request.employee_id, request_id: request.request_id, message: body.decision === 'Approve' ? 'Your inspection request has been approved.' : 'Your manager has requested additional information.', created_at: new Date().toISOString() });
    save(store);
    return ok({ decision });
  }

  const confirmMatch = path.match(/^\/requests\/([^/]+)\/confirm-action$/);
  if (confirmMatch && options.method === 'POST') {
    const request = store.requests.find((r) => r.request_id === confirmMatch[1]);
    const task = store.tasks.find((t) => t.request_id === confirmMatch[1]);
    if (!request || !task) return fail('No assigned handling task found');
    const existing = store.movements.find((m) => m.handling_task_id === task.task_id);
    if (existing) return ok({ task, movement: existing });
    const stock = store.inventory.find((i) => i.material_id === request.material_id);
    if (!stock) return fail('Stock balance not found');
    if (stock.available_qty < request.quantity) return fail('Insufficient stock; inventory was not updated.');
    const before = stock.available_qty;
    const movement_type = request.final_disposition === 'Scrap' ? 'SCRAP' : 'REPAIR_REUSE';
    stock.available_qty -= request.quantity;
    if (movement_type === 'SCRAP') stock.scrapped_qty += request.quantity;
    else stock.repair_qty += request.quantity;
    const movement = {
      movement_id: uid('mov'),
      handling_task_id: task.task_id,
      request_id: request.request_id,
      material_id: request.material_id,
      movement_type,
      quantity: request.quantity,
      available_before: before,
      available_after: stock.available_qty,
      authorized_by_name: 'System after employee confirmation',
      created_at: new Date().toISOString()
    };
    store.movements.unshift(movement);
    task.status = 'COMPLETED';
    task.handling_status = 'COMPLETED';
    task.employee_confirmed_at = new Date().toISOString();
    task.manager_verified_at = task.employee_confirmed_at;
    request.status = 'Completed';
    save(store);
    return ok({ task, movement });
  }

  if (path === '/inventory') return ok({ inventory: store.inventory });
  if (path === '/inventory/pending-verification') {
    const tasks = store.tasks.filter((t) => t.status === 'EMPLOYEE_CONFIRMED').map((t) => {
      const request = store.requests.find((r) => r.request_id === t.request_id);
      return { ...t, material_id: request.material_id, approved_quantity: request.quantity, approved_action: t.action, employee_confirmation: t.employee_confirmed_at, evidence: request.storage_key };
    });
    return ok({ tasks });
  }
  const verifyMatch = path.match(/^\/inventory\/verify\/(.+)$/);
  if (verifyMatch && options.method === 'POST') {
    const existing = store.movements.find((m) => m.handling_task_id === verifyMatch[1]);
    if (existing) return ok({ movement: existing });
    const task = store.tasks.find((t) => t.task_id === verifyMatch[1]);
    if (!task || task.status !== 'EMPLOYEE_CONFIRMED') return fail('Employee confirmation is required before verification');
    const request = store.requests.find((r) => r.request_id === task.request_id);
    const stock = store.inventory.find((i) => i.material_id === request.material_id);
    if (stock.available_qty < request.quantity) return fail('Insufficient stock; transaction rolled back');
    const before = stock.available_qty;
    stock.available_qty -= request.quantity;
    const movement_type = request.final_disposition === 'Scrap' ? 'SCRAP' : 'REPAIR_REUSE';
    if (movement_type === 'SCRAP') stock.scrapped_qty += request.quantity;
    else stock.repair_qty += request.quantity;
    task.status = 'COMPLETED';
    request.status = 'Completed';
    const movement = { movement_id: uid('mov'), handling_task_id: task.task_id, request_id: request.request_id, material_id: request.material_id, movement_type, quantity: request.quantity, available_before: before, available_after: stock.available_qty, authorized_by_name: user.full_name, created_at: new Date().toISOString() };
    store.movements.unshift(movement);
    save(store);
    return ok({ movement });
  }
  if (path.startsWith('/inventory/movements')) return ok({ movements: store.movements });

  if (path === '/analytics/summary') {
    return ok({ summary: summary(store) });
  }
  if (path === '/analytics/trends') return ok({ trends: {}, ...trends(store) });
  if (path === '/analytics/insights') return ok({ insights: insights(store) });
  if (path === '/notifications') return ok({ notifications: store.notifications.filter((n) => n.user_id === user.user_id) });
  if (path === '/chat' && options.method === 'POST') {
    const question = JSON.parse(options.body).question.toLowerCase();
    const s = summary(store);
    let answer = 'I can help with inspected counts, scrapped units, repair or reuse counts, scrap value, common defects, and pending requests.';
    if (question.includes('inspected')) answer = `${s.total_requests} products have been submitted for inspection.`;
    else if (question.includes('scrap value')) answer = `Estimated scrap value is ${s.estimated_scrap_value}. Formula: verified scrapped quantity multiplied by material unit cost.`;
    else if (question.includes('scrap')) answer = `${s.scrapped_units} units have been verified as scrapped.`;
    else if (question.includes('repair') || question.includes('reuse')) answer = `${store.movements.filter((m) => m.movement_type === 'REPAIR_REUSE').reduce((a, m) => a + m.quantity, 0)} units have been verified for repair or reuse.`;
    else if (question.includes('defect')) answer = commonDefect(store)?.name ? `The most common defect is ${commonDefect(store).name}.` : 'No defect findings are available yet.';
    else if (question.includes('pending')) answer = `${s.pending_approvals} inspection request(s) are pending manager review.`;
    return ok({ answer });
  }
  return fail(`Mock endpoint not implemented: ${path}`);
}

function summary(store) {
  const scrapped_units = store.movements.filter((m) => m.movement_type === 'SCRAP').reduce((a, m) => a + m.quantity, 0);
  const today = new Date().toISOString().slice(0, 10);
  const approved_today = store.decisions.filter((decision) => decision.decision === 'Approve' && String(decision.created_at || '').slice(0, 10) === today).length;
  const estimated_scrap_value = store.movements.filter((m) => m.movement_type === 'SCRAP').reduce((a, m) => {
    const mat = store.inventory.find((i) => i.material_id === m.material_id);
    return a + m.quantity * Number(mat?.unit_cost || 0);
  }, 0).toFixed(2);
  return {
    total_requests: store.requests.length,
    pending_approvals: store.requests.filter((r) => r.status === 'Pending Manager Review').length,
    approved_today,
    approved_requests: store.requests.filter((r) => ['Awaiting Material Handling', 'Pending Inventory Verification', 'Completed'].includes(r.status)).length,
    rejected_requests: store.requests.filter((r) => r.status === 'Rejected').length,
    repair_reuse_candidates: store.requests.filter((r) => r.final_disposition === 'Repair / Reuse').length,
    scrapped_units,
    estimated_scrap_value
  };
}

function trends(store) {
  const countBy = (items, getName) => Object.values(items.reduce((acc, item) => {
    const name = getName(item) || 'Unavailable';
    acc[name] = acc[name] || { name, value: 0 };
    acc[name].value += 1;
    return acc;
  }, {}));
  const defects = store.reports.flatMap((r) => r.damage_analysis.detectedDefects || []);
  return {
    classification: countBy(store.reports, (r) => r.raw_classification),
    reuse: countBy(store.requests, (r) => r.final_disposition || 'Pending'),
    monthly: [{ month: new Date().toISOString().slice(0, 7), inspections: store.requests.length }],
    defects: countBy(defects, (d) => d.type)
  };
}

function commonDefect(store) {
  return trends(store).defects.sort((a, b) => b.value - a.value)[0] || null;
}

function insights(store) {
  const latest = store.reports[0];
  const defect = commonDefect(store);
  const hardGates = store.reports.flatMap((report) => report.hard_gates || []);
  const hardGatePattern = hardGates.length
    ? `${hardGates[0]} (${hardGates.length} signal${hardGates.length === 1 ? '' : 's'} observed)`
    : null;
  const repairCandidates = store.reports.filter((report) => report.raw_classification === 'REPAIR_REUSE_CANDIDATE').length;
  const manualReviews = store.reports.filter((report) => report.effective_recommendation === 'MANUAL_REVIEW_REQUIRED').length;
  return {
    mostCommonObservation: defect ? `${defect.name} appeared in ${defect.value} AI finding${defect.value === 1 ? '' : 's'}.` : null,
    recommendation: defect ? `Review handling and supplier quality controls related to ${defect.name.replaceAll('_', ' ')}.` : null,
    potentialAnnualSavings: store.movements.length ? `Estimated from verified recovery actions: ${summary(store).estimated_scrap_value}` : null,
    predictedScrapIncrease: store.reports.length > 1 ? 'Trend signal available after multiple inspection cycles.' : null,
    highRiskDepartment: latest ? 'Warehouse A / PCB handling lane needs manager attention in demo data.' : null,
    latestRiskSignal: latest ? `${latest.effective_recommendation || 'Unavailable'} for latest inspected product. Composite risk score: ${latest.composite_score ?? 'manual review'}.` : null,
    hardGatePattern,
    recoveryOpportunity: repairCandidates ? `${repairCandidates} inspected product${repairCandidates === 1 ? '' : 's'} landed in the repair/reuse candidate band before manager decision.` : null,
    inspectionQualityNote: latest ? latest.summary : null,
    managementTakeaway: store.reports.length
      ? `${store.reports.length} AI report${store.reports.length === 1 ? '' : 's'} generated; ${manualReviews} require manual-review attention because of safety gates or missing evidence.`
      : null
  };
}
