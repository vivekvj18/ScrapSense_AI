# Architecture

ScrapSense AI is a modular monolith with three layers.

## Frontend

React and Vite provide exactly six routed pages:

1. `/login`
2. `/employee/inspection`
3. `/employee/requests`
4. `/manager/review`
5. `/manager/dashboard`
6. `/manager/insights`

All backend calls go through `frontend/src/services/api.js`. Employees never receive AI report fields from employee endpoints.

## Backend

One Express process contains modules for:

- Authentication
- Materials
- Inspection requests
- AI inspection
- Manager approvals
- Inventory
- Analytics
- Chatbot
- Notifications
- Audit

Role checks are enforced with Express middleware and ownership-aware SQL queries.

## Database

PostgreSQL stores users, materials, stock balances, requests, images, reports, decisions, handling tasks, stock movements, notifications, and audit events. Uploaded image bytes remain on disk; PostgreSQL stores protected storage keys.

## AI Workflow

The AI module contains:

- `orchestrator.js`
- `visionModelClient.js`
- `agents/damageDetectionAgent.js`
- `agents/materialValidationAgent.js`
- `agents/reasonConsistencyAgent.js`
- `scoringEngine.js`
- `safetyValidationEngine.js`
- `reportGenerator.js`

Damage and material validation run concurrently. Reason consistency runs after damage findings are available. The scoring engine deterministically calculates the composite score only when all required scores are available. Safety gates then produce the effective recommendation.

## Inventory Workflow

Manager approval does not update stock. Employee handling confirmation does not update stock. Only manager verification executes the transaction that adjusts stock balances and writes stock movement history.
