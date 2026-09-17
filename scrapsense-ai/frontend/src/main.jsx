import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, Bot, CheckCircle2, ClipboardList, Factory, FileSearch, Lightbulb, LogOut, PackageCheck, RefreshCw, Send, Target, TrendingUp, UploadCloud } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import './index.css';
import { api, clearSession, getUser, imageUrl, resetMockDemoData, setSession } from './services/api.js';

function Shell({ children, role }) {
  const navigate = useNavigate();
  const links = role === 'MANAGER'
    ? [['/manager/dashboard', 'Dashboard'], ['/manager/review', 'Review'], ['/manager/insights', 'Insights']]
    : [['/employee/inspection', 'New Inspection'], ['/employee/requests', 'My Requests']];
  return <div className="min-h-screen">
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to={role === 'MANAGER' ? '/manager/dashboard' : '/employee/inspection'} className="flex items-center gap-2 font-bold"><Factory size={20}/>ScrapSense AI</Link>
        <nav className="flex items-center gap-2">
          {links.map(([to, label]) => <Link key={to} className="rounded-md px-3 py-2 text-sm hover:bg-white/10" to={to}>{label}</Link>)}
          <button className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => { clearSession(); navigate('/login'); }}><LogOut size={16}/>Sign out</button>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    {role === 'MANAGER' && <FloatingChatAssistant/>}
  </div>;
}

function Protected({ role, children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'MANAGER' ? '/manager/dashboard' : '/employee/inspection'} replace />;
  return <Shell role={user.role}>{children}</Shell>;
}

function LoginPage() {
  const params = new URLSearchParams(window.location.search);
  const requestedRole = params.get('role');
  const defaultManager = requestedRole === 'manager';
  const [identifier, setIdentifier] = useState(defaultManager ? 'manager@scrapsense.local' : 'employee@scrapsense.local');
  const [password, setPassword] = useState(defaultManager ? 'manager123' : 'employee123');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  async function signIn(nextIdentifier = identifier, nextPassword = password) {
    setError('');
    try {
      const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: nextIdentifier, password: nextPassword }) });
      setSession(data.token, data.user);
      navigate(data.user.role === 'MANAGER' ? '/manager/dashboard' : '/employee/inspection');
    } catch (err) { setError(err.message); }
  }
  async function submit(e) {
    e.preventDefault();
    signIn();
  }
  useEffect(() => {
    if (params.get('auto') === '1') {
      signIn(defaultManager ? 'manager@scrapsense.local' : 'employee@scrapsense.local', defaultManager ? 'manager123' : 'employee123');
    }
  }, []);
  return <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
    <form onSubmit={submit} className="card w-full max-w-md">
      <div className="mb-6 flex items-center gap-3"><Factory className="text-tealai"/><div><h1 className="text-2xl font-bold text-navy">Welcome to ScrapSense AI</h1><p className="text-sm text-slate-600">Intelligent Material Inspection & Recovery</p></div></div>
      <label className="label">Employee ID / Email</label><input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
      <label className="label mt-4">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button className="btn-primary mt-5 w-full">Sign In</button>
      <button type="button" className="btn-secondary mt-3 w-full" onClick={() => { resetMockDemoData(); setError('Demo data reset. Log in to start fresh.'); }}>Reset demo data</button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a className="btn-secondary justify-center" href="/login?role=employee&auto=1" target="_blank" rel="noreferrer">Employee URL</a>
        <a className="btn-secondary justify-center" href="/login?role=manager&auto=1" target="_blank" rel="noreferrer">Manager URL</a>
      </div>
      <p className="mt-4 text-xs text-slate-500">Demo: employee@scrapsense.local / employee123 or manager@scrapsense.local / manager123</p>
    </form>
  </div>;
}

function PageTitle({ title, desc, icon: Icon }) {
  return <div className="mb-5 flex items-start gap-3"><Icon className="mt-1 text-tealai"/><div><h1 className="text-2xl font-bold text-navy">{title}</h1><p className="text-sm text-slate-600">{desc}</p></div></div>;
}

function EmployeeInspectionPage() {
  const [form, setForm] = useState({ materialId: 'MAT-1001', productNumber: '', materialName: '', location: '', quantity: 1, reportedReason: 'Visible burn damage', employeeComments: 'Blackened area near a component.', demoCase: 'burn' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  function update(name, value) { setForm((f) => ({ ...f, [name]: value })); }
  async function lookup() {
    if (!form.materialId) return;
    try {
      const { material } = await api(`/materials/${form.materialId}`);
      setForm((f) => ({ ...f, productNumber: material.product_number, materialName: material.material_name, location: material.location }));
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { lookup(); }, []);
  function chooseFile(next) {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : '');
  }
  async function submit(e) {
    e.preventDefault();
    setError(''); setMessage('');
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
    if (file) body.append('image', file);
    try {
      const data = await api('/requests', { method: 'POST', body });
      setMessage(`${data.message} Request ID: ${data.request.request_number}`);
      setTimeout(() => navigate('/employee/requests'), 900);
    } catch (err) { setError(err.message); }
  }
  return <><PageTitle title="New Material Inspection" desc="Provide material details, describe the suspected issue, and upload a photograph for AI-assisted inspection." icon={UploadCloud}/>
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <section className="card">
        <h2 className="mb-4 font-semibold text-navy">Material Information</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className="label">Material ID</label><input value={form.materialId} onBlur={lookup} onChange={(e) => update('materialId', e.target.value)} placeholder="MAT-1001"/></div>
          <div><label className="label">Product Number</label><input value={form.productNumber} onChange={(e) => update('productNumber', e.target.value)} placeholder="PCB-A101"/></div>
          <div><label className="label">Material Name</label><input value={form.materialName} readOnly placeholder="Industrial Control PCB"/></div>
          <div><label className="label">Location</label><input value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Warehouse A"/></div>
          <div><label className="label">Quantity</label><input type="number" min="1" value={form.quantity} onChange={(e) => update('quantity', e.target.value)} /></div>
          <div><label className="label">Demo Case</label><select value={form.demoCase} onChange={(e) => update('demoCase', e.target.value)}><option value="burn">Burn damage</option><option value="scratch">Repairable scratch</option><option value="clean">Clean item</option><option value="mismatch">Material mismatch</option></select></div>
          <div className="md:col-span-2"><label className="label">Reported Reason</label><input value={form.reportedReason} onChange={(e) => update('reportedReason', e.target.value)} placeholder="Visible burn damage"/></div>
          <div className="md:col-span-2"><label className="label">Additional Comments</label><textarea value={form.employeeComments} onChange={(e) => update('employeeComments', e.target.value)} placeholder="Blackened area near a component."/></div>
        </div>
      </section>
      <section className="card">
        <h2 className="font-semibold text-navy">Upload Material Image</h2><p className="mb-3 text-sm text-slate-600">Upload a clear photograph showing the material and suspected defect.</p>
        <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-600">
          {preview ? <img src={preview} className="max-h-48 rounded-md object-contain"/> : <><UploadCloud className="mb-2 text-tealai"/><span>JPG, JPEG, PNG, or WEBP up to 10 MB</span></>}
          <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseFile(e.target.files[0])}/>
        </label>
        <div className="mt-3 flex gap-2"><button type="button" className="btn-secondary" onClick={() => chooseFile(null)}>Remove image</button><button className="btn-primary">Submit for Inspection</button></div>
        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}{error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>
    </form></>;
}

function EmployeeRequestsPage() {
  const [rows, setRows] = useState([]); const [notes, setNotes] = useState([]);
  async function load() { const [r, n] = await Promise.all([api('/requests/my'), api('/notifications')]); setRows(r.requests); setNotes(n.notifications); }
  useEffect(() => { load(); }, []);
  async function confirm(id) { await api(`/requests/${id}/confirm-action`, { method: 'POST', body: '{}' }); load(); }
  return <><PageTitle title="My Requests & Actions" desc="Track submitted inspections and complete actions assigned by your manager." icon={ClipboardList}/>
    <NotificationPanel notes={notes}/>
    <Table headers={['Request ID','Material ID','Material Name','Qty','Reason','Submission Date','Status','Action']}>
      {rows.map((r) => <tr key={r.request_id}><td className="td">{r.request_number}</td><td className="td">{r.material_id}</td><td className="td">{r.material_name}</td><td className="td">{r.quantity}</td><td className="td">{r.reported_reason}</td><td className="td">{fmt(r.submitted_at)}</td><td className="td">{r.status}</td><td className="td">{r.handling_status === 'ASSIGNED' ? <button className="btn-primary" onClick={() => confirm(r.request_id)}>Confirm Physical Action</button> : r.disposition || 'View status'}</td></tr>)}
    </Table></>;
}

function ManagerReviewPage() {
  const [rows, setRows] = useState([]); const [selected, setSelected] = useState(null); const [report, setReport] = useState(null); const [decision, setDecision] = useState({ decision: 'Approve', disposition: 'Scrap', remarks: '' });
  async function load() { const r = await api('/requests'); setRows(r.requests); }
  async function select(id) { const [detail, rep] = await Promise.all([api(`/requests/${id}`), api(`/inspections/${id}/report`).catch(() => ({ report: null }))]); setSelected(detail.request); setReport(rep.report); }
  useEffect(() => { load(); }, []);
  async function decide() { await api(`/requests/${selected.request_id}/decision`, { method: 'POST', body: JSON.stringify(decision) }); await load(); await select(selected.request_id); }
  return <><PageTitle title="Inspection Review & Approval" desc="Review employee submissions and AI inspection findings before making the final decision." icon={FileSearch}/>
    <div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
      <section className="card overflow-auto"><h2 className="mb-3 font-semibold text-navy">Pending Requests</h2><Table headers={['Request ID','Employee','Material','Reason','AI Status','Action']}>{rows.map((r) => <tr key={r.request_id}><td className="td">{r.request_number}</td><td className="td">{r.employee}</td><td className="td">{r.material_id}</td><td className="td">{r.reported_reason}</td><td className="td">{r.status}</td><td className="td"><button className="btn-secondary" onClick={() => select(r.request_id)}>Review</button></td></tr>)}</Table></section>
      <section className="card">{!selected ? <Empty text="Select a request to review."/> : <InspectionReport request={selected} report={report} decision={decision} setDecision={setDecision} decide={decide}/>}</section>
    </div></>;
}

function InspectionReport({ request, report, decision, setDecision, decide }) {
  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-[180px_1fr]">{request.storage_key && <img src={imageUrl(request.storage_key)} className="h-40 w-full rounded-md object-cover"/>}<div><h2 className="text-lg font-bold text-navy">{request.request_number}</h2><p className="text-sm text-slate-600">{request.employee_name} · {request.material_id} · {request.product_number} · {request.material_name}</p><p className="mt-2 text-sm">Reason: {request.reported_reason}</p><p className="text-sm">Quantity: {request.quantity}</p></div></div>
    {!report ? <Empty text="AI report is not available yet."/> : <><div className="grid gap-3 md:grid-cols-3"><AgentResult title="Damage Detection" score={report.damage_score} body={report.damage_analysis}/><AgentResult title="Material Validation" score={report.material_match_score} body={report.material_validation}/><AgentResult title="Reason Consistency" score={report.reason_consistency_score} body={report.reason_consistency}/></div><div className="rounded-lg border border-slate-200 p-3"><h3 className="font-semibold text-navy">Composite Inspection Risk Score</h3><p className="text-2xl font-bold">{report.composite_score ?? 'Manual review'}</p><p className="text-sm text-slate-600">Raw weighted category: {report.raw_classification || 'Unavailable'} · Effective recommendation: {report.effective_recommendation}</p><p className="mt-2 text-sm">{report.summary}</p>{report.hard_gates?.length > 0 && <Warning title="Hard Gates" items={report.hard_gates}/>} {report.warnings?.length > 0 && <Warning title="Warnings" items={report.warnings}/>}</div></>}
    <div className="grid gap-3 md:grid-cols-3"><select value={decision.decision} onChange={(e) => setDecision({...decision, decision: e.target.value})}><option>Approve</option><option>Reject</option><option>Request Additional Information</option></select><select value={decision.disposition} onChange={(e) => setDecision({...decision, disposition: e.target.value})}><option>Continue Use</option><option>Repair / Reuse</option><option>Scrap</option><option>Manual Inspection Required</option></select><input placeholder="Manager remarks" value={decision.remarks} onChange={(e) => setDecision({...decision, remarks: e.target.value})}/></div><button className="btn-primary" onClick={decide}>Record Decision</button>
  </div>;
}

function ManagerDashboardPage() {
  const [summary, setSummary] = useState(null); const [trends, setTrends] = useState(null); const [tab, setTab] = useState('stock'); const [inventory, setInventory] = useState([]); const [tasks, setTasks] = useState([]); const [movements, setMovements] = useState([]);
  async function load() { const [s,t,i,p,m] = await Promise.all([api('/analytics/summary'), api('/analytics/trends'), api('/inventory'), api('/inventory/pending-verification'), api('/inventory/movements')]); setSummary(s.summary); setTrends(t); setInventory(i.inventory); setTasks(p.tasks); setMovements(m.movements); }
  useEffect(() => { load(); }, []);
  async function verify(taskId) { await api(`/inventory/verify/${taskId}`, { method: 'POST', body: '{}' }); load(); }
  const headlineStats = summary ? [
    ['Total Requests', summary.total_requests, 'text-blue-700'],
    ['Pending Approval', summary.pending_approvals, 'text-amber-600'],
    ['Approved Today', summary.approved_today, 'text-green-700']
  ] : [];
  const secondaryStats = summary ? [
    ['Approved Requests', summary.approved_requests],
    ['Rejected Requests', summary.rejected_requests],
    ['Repair / Reuse Candidates', summary.repair_reuse_candidates],
    ['Scrapped Units', summary.scrapped_units],
    ['Estimated Scrap Value', summary.estimated_scrap_value]
  ] : [];
  const riskRows = inventory
    .map((item) => ({ name: item.material_name, risk: item.scrapped_qty > 0 ? 'High' : item.repair_qty > 0 ? 'Medium' : 'Low' }))
    .slice(0, 4);
  return <><PageTitle title="AI Inspection Dashboard" desc="Monitor inspection activity, approval decisions, material recovery, and inventory performance." icon={BarChart3}/>
    {summary && <section className="card mb-4">
      <div className="grid gap-4 md:grid-cols-3">
        {headlineStats.map(([label, value, color]) => <div key={label}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className={`mt-1 text-4xl font-bold ${color}`}>{value}</p>
        </div>)}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {secondaryStats.map(([label, value]) => <div key={label} className="rounded-md bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-lg font-bold text-navy">{value}</p>
        </div>)}
      </div>
    </section>}
    {trends && <div className="mb-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      <LinePanel data={trends.monthly}/>
      <section className="card">
        <h2 className="mb-3 font-semibold text-navy">Top Scrap Reasons</h2>
        {trends.defects.length ? <div className="grid gap-3 md:grid-cols-[1fr_1fr] lg:grid-cols-1 xl:grid-cols-[1fr_1fr]">
          <ResponsiveContainer width="100%" height={210}><PieChart><Pie dataKey="value" data={trends.defects} outerRadius={78}>{trends.defects.map((_,i)=><Cell key={i} fill={['#2563eb','#f59e0b','#16a34a','#64748b','#dc2626'][i%5]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>
          <div className="space-y-2">{trends.defects.map((row, index) => <div key={row.name} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"><span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: ['#2563eb','#f59e0b','#16a34a','#64748b','#dc2626'][index%5] }}></span>{row.name.replaceAll('_',' ')}</span><b>{row.value}</b></div>)}</div>
        </div> : <Empty text="No scrap reason data available yet."/>}
      </section>
      <Chart title="Inspection Classification Distribution" data={trends.classification}/>
      <section className="card">
        <h2 className="mb-3 font-semibold text-navy">High Risk Materials</h2>
        <div className="space-y-2">{riskRows.map((row) => <div key={row.name} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-sm"><span>{row.name}</span><span className={row.risk === 'High' ? 'font-semibold text-red-600' : row.risk === 'Medium' ? 'font-semibold text-amber-600' : 'font-semibold text-green-700'}>{row.risk}</span></div>)}</div>
      </section>
    </div>}
    <section className="card"><div className="mb-3 flex gap-2">{['stock','history'].map((x) => <button key={x} className={tab===x?'btn-primary':'btn-secondary'} onClick={() => setTab(x)}>{x === 'stock' ? 'Stock Overview' : 'Stock Movement History'}</button>)}</div>
      {tab === 'stock' && <Table headers={['Material ID','Product Number','Material Name','Available','Repair / Reuse','Scrapped','Unit Cost']}>{inventory.map((r) => <tr key={r.material_id}><td className="td">{r.material_id}</td><td className="td">{r.product_number}</td><td className="td">{r.material_name}</td><td className="td">{r.available_qty}</td><td className="td">{r.repair_qty}</td><td className="td">{r.scrapped_qty}</td><td className="td">{r.unit_cost}</td></tr>)}</Table>}
      {tab === 'history' && <Table headers={['Movement ID','Request ID','Material ID','Operation','Qty','Previous','Updated','Authorized','Timestamp']}>{movements.map((r) => <tr key={r.movement_id}><td className="td">{r.movement_id.slice(0,8)}</td><td className="td">{r.request_id.slice(0,8)}</td><td className="td">{r.material_id}</td><td className="td">{r.movement_type}</td><td className="td">{r.quantity}</td><td className="td">{r.available_before}</td><td className="td">{r.available_after}</td><td className="td">{r.authorized_by_name}</td><td className="td">{fmt(r.created_at)}</td></tr>)}</Table>}
    </section></>;
}

function InsightsPage() {
  const [insights, setInsights] = useState(null);
  useEffect(() => { api('/analytics/insights').then((r) => setInsights(r.insights)); }, []);
  const cards = insights ? [
    [Lightbulb, 'AI Observation', insights.mostCommonObservation || 'No AI observations yet.'],
    [Target, 'Recommendation', insights.recommendation || 'Submit an inspection to generate a recommendation.'],
    [PackageCheck, 'Potential Annual Savings', insights.potentialAnnualSavings || 'Savings estimate appears after verified recovery or scrap movement.'],
    [TrendingUp, 'Predicted Scrap Increase', insights.predictedScrapIncrease || 'Prediction needs more inspection history.'],
    [Factory, 'High Risk Department', insights.highRiskDepartment || 'No high-risk department signal yet.'],
    [AlertTriangle, 'Hard Gate Pattern', insights.hardGatePattern || 'No hard gates have been triggered yet.']
  ] : [];
  return <><PageTitle title="AI Insights" desc="Review AI observations about inspected products, visible defect patterns, recovery opportunities, and manual-review signals." icon={Bot}/>
    <section className="mx-auto max-w-3xl space-y-4">
      {cards.map(([Icon, title, value]) => <div key={title} className="card flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-tealai"><Icon size={22}/></div>
        <div>
          <p className="font-semibold text-navy">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{String(value)}</p>
        </div>
      </div>)}
    </section>
    {!insights && <Empty text="AI insights will appear after inspection reports are generated."/>}
  </>;
}

function FloatingChatAssistant() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('How many products were scrapped?');
  const [messages, setMessages] = useState([{ from: 'bot', text: 'Hello! I can help with inspection activity, scrap quantities, recovery opportunities, and inventory information.' }]);
  const suggestions = ['How many products were inspected?', 'How many products were scrapped?', 'What is the estimated scrap value?'];
  async function ask(next = question) {
    if (!next.trim()) return;
    const response = await api('/chat', { method: 'POST', body: JSON.stringify({ question: next }) });
    setMessages((items) => [...items, { from: 'user', text: next }, { from: 'bot', text: response.answer }]);
    setQuestion('');
  }
  return <div className="fixed bottom-5 right-5 z-50">
    {open && <div className="mb-3 w-[min(360px,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between rounded-t-lg bg-navy px-4 py-3 text-white">
        <div className="flex items-center gap-2"><Bot size={18}/><span className="font-semibold">ScrapSense Assistant</span></div>
        <button className="rounded-md px-2 py-1 text-white hover:bg-white/10" onClick={() => setOpen(false)}>Close</button>
      </div>
      <div className="max-h-72 overflow-auto p-3">
        {messages.map((message, index) => <div key={index} className={`mb-2 rounded-md px-3 py-2 text-sm ${message.from === 'bot' ? 'bg-slate-100 text-navy' : 'bg-teal-50 text-teal-800'}`}>
          <b>{message.from === 'bot' ? 'Assistant' : 'You'}:</b> {message.text}
        </div>)}
      </div>
      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 flex flex-wrap gap-2">{suggestions.map((item) => <button key={item} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50" onClick={() => ask(item)}>{item}</button>)}</div>
        <div className="flex gap-2"><input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') ask(); }} placeholder="Ask about inspections or inventory"/><button className="btn-primary px-3" onClick={() => ask()}><Send size={16}/></button></div>
      </div>
    </div>}
    <button aria-label="Open ScrapSense Assistant" className="flex h-14 w-14 items-center justify-center rounded-full bg-tealai text-white shadow-lg hover:bg-teal-700" onClick={() => setOpen((value) => !value)}>
      <Bot size={24}/>
    </button>
  </div>;
}

function AgentResult({ title, score, body }) { return <div className="rounded-lg border border-slate-200 p-3"><h3 className="font-semibold text-navy">{title}</h3><p className="text-xl font-bold">{score ?? 'Unavailable'}</p><p className="text-sm text-slate-600">{body?.explanation}</p></div>; }
function Warning({ title, items }) { return <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><b>{title}</b>{items.map((i) => <p key={i}>• {i}</p>)}</div>; }
function NotificationPanel({ notes }) { return <div className="mb-4 grid gap-2">{notes.map((n) => <div key={n.notification_id} className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900"><CheckCircle2 className="mr-2 inline" size={16}/>{n.message}</div>)}</div>; }
function Table({ headers, children }) { return <div className="overflow-auto rounded-lg border border-slate-200"><table className="w-full min-w-[720px] bg-white"><thead><tr>{headers.map((h) => <th className="th" key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Empty({ text }) { return <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500"><AlertTriangle className="mx-auto mb-2 text-amber-500"/>{text}</div>; }
function Chart({ title, data }) { return <div className="card"><h2 className="mb-3 font-semibold text-navy">{title}</h2>{data.length ? <ResponsiveContainer width="100%" height={220}><PieChart><Pie dataKey="value" data={data} label>{data.map((_,i)=><Cell key={i} fill={['#0f9f9a','#0f2a43','#16a34a','#f59e0b','#dc2626'][i%5]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer> : <Empty text="No data available."/>}</div>; }
function LinePanel({ data }) { return <div className="card"><h2 className="mb-3 font-semibold text-navy">Monthly Inspection Trends</h2>{data.length ? <ResponsiveContainer width="100%" height={220}><LineChart data={data}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month"/><YAxis allowDecimals={false}/><Tooltip/><Line dataKey="inspections" stroke="#0f9f9a" strokeWidth={2}/></LineChart></ResponsiveContainer> : <Empty text="No data available."/>}</div>; }
function fmt(value) { return value ? new Date(value).toLocaleString() : ''; }

function App() {
  return <BrowserRouter><Routes>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/employee/inspection" element={<Protected role="EMPLOYEE"><EmployeeInspectionPage/></Protected>}/>
    <Route path="/employee/requests" element={<Protected role="EMPLOYEE"><EmployeeRequestsPage/></Protected>}/>
    <Route path="/manager/review" element={<Protected role="MANAGER"><ManagerReviewPage/></Protected>}/>
    <Route path="/manager/dashboard" element={<Protected role="MANAGER"><ManagerDashboardPage/></Protected>}/>
    <Route path="/manager/insights" element={<Protected role="MANAGER"><InsightsPage/></Protected>}/>
    <Route path="*" element={<Navigate to="/login" replace/>}/>
  </Routes></BrowserRouter>;
}

createRoot(document.getElementById('root')).render(<App />);
