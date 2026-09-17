# ScrapSense AI

Intelligent Material Inspection & Recovery

Tagline: Detect Defects. Recover Value. Reduce Waste.

ScrapSense AI is a hackathon prototype for AI-assisted material inspection. Employees submit damaged material photos, the backend runs three specialized inspection agents, managers review the explainable report, and inventory is updated only after employee handling confirmation and manager verification.

## Technology Stack

- Frontend: React, Vite, JavaScript, Tailwind CSS, React Router, Lucide React, Recharts
- Backend: Node.js, Express.js, JavaScript
- Database: PostgreSQL with `pg`
- Architecture: Modular monolith
- AI mode: Explicit `MOCK` mode by default, with a `visionModelClient.js` adapter placeholder for live image-capable model integration

## Setup

```bash
cd scrapsense-ai
npm run install:all
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
createdb scrapsense_ai
npm run migrate --prefix backend
npm run seed --prefix backend
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:4000`

## Demo Credentials

- Employee: `employee@scrapsense.local` / `employee123`
- Manager: `manager@scrapsense.local` / `manager123`

## Environment Variables

Backend:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `AI_MODE=MOCK`
- `UPLOAD_DIR`
- `FRONTEND_ORIGIN`

Frontend:

- `VITE_API_BASE_URL`

## End-to-End Demo

1. Log in as the employee.
2. Open New Material Inspection.
3. Use `MAT-1001`, product `PCB-A101`, quantity `1`, and upload a JPG/PNG/WEBP image.
4. Submit for inspection.
5. Open My Requests & Actions and confirm the employee cannot see internal AI scores.
6. Log in as the manager.
7. Open Inspection Review & Approval.
8. Review the uploaded image, agent outputs, score breakdown, hard gates, warnings, and recommendation.
9. Approve a disposition such as Scrap or Repair / Reuse.
10. Log in as the employee and confirm the physical handling action.
11. Log in as the manager, open AI Dashboard, go to Pending Verification, and verify stock movement.
12. Confirm stock balances and movement history update once.
13. Open AI Insights and ask the assistant about scrap quantities.

## Implemented Features

- Exactly six frontend pages.
- Shared login with JWT authentication.
- Employee material lookup, image upload, request submission, notifications, and handling confirmation.
- Manager review with three AI agent result panels and decision recording.
- PostgreSQL migrations and seed data.
- Transactional inventory verification with duplicate movement protection.
- Analytics dashboard charts and inventory tabs.
- Deterministic chatbot using authorized read-only analytics queries.
- Unit tests for scoring and safety gates.

## Simulated Features

`AI_MODE=MOCK` uses clearly labeled simulated demonstration cases. It does not pretend to validate arbitrary industrial imagery. Live AI requires implementing a provider adapter in `backend/src/modules/ai/visionModelClient.js`.

## Known Limitations

- The PCB dataset entries are documented placeholders, not training data.
- The mock AI agents are deterministic demonstration logic.
- The score weights are prototype configuration and are not scientifically validated.
- The composite risk score is not pure physical damage severity.
- Critical-damage hard gates can force manual review even when the raw weighted score is moderate.
