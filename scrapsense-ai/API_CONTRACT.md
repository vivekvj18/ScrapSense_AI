# API Contract

All protected endpoints require `Authorization: Bearer <token>`. Errors use:

```json
{ "error": { "message": "Human readable message", "details": {} } }
```

## Authentication

`POST /api/auth/login`

Request:

```json
{ "identifier": "employee@scrapsense.local", "password": "employee123" }
```

Response:

```json
{ "token": "jwt", "user": { "user_id": "uuid", "employee_code": "EMP-100", "full_name": "Anika Patel", "email": "employee@scrapsense.local", "role": "EMPLOYEE" } }
```

`GET /api/auth/me`

Response:

```json
{ "user": { "user_id": "uuid", "employee_code": "MGR-100", "full_name": "Rohan Mehta", "email": "manager@scrapsense.local", "role": "MANAGER" } }
```

## Materials

`GET /api/materials/:materialId`

Returns minimal employee-safe catalog data plus available quantity for validation. Manager-only financial data is exposed only through inventory endpoints.

## Inspection Requests

`POST /api/requests`

Multipart form fields: `materialId`, `productNumber`, `location`, `quantity`, `reportedReason`, `employeeComments`, `demoCase`, `image`.

Response:

```json
{ "message": "Your inspection request has been submitted successfully.", "request": { "request_id": "uuid", "request_number": "REQ-12345678", "status": "Submitted" } }
```

`GET /api/requests/my`

Employee-only. Returns the employee's requests without AI report fields.

`GET /api/requests`

Manager-only. Returns all submitted requests.

`GET /api/requests/:id`

Manager can view any request. Employee can view only their own request.

`POST /api/requests/:id/confirm-action`

Employee-only. Confirms assigned physical handling and moves the request to pending inventory verification.

## AI

`POST /api/inspections/:requestId/analyze`

Manager-only manual re-analysis trigger.

`GET /api/inspections/:requestId/report`

Manager-only. Returns latest AI report, agent JSON, scores, hard gates, warnings, and recommendation.

## Manager Decision

`POST /api/requests/:id/decision`

Request:

```json
{ "decision": "Approve", "disposition": "Scrap", "remarks": "Critical burn damage visible.", "overrideReason": "" }
```

Decisions: `Approve`, `Reject`, `Request Additional Information`.

Dispositions: `Continue Use`, `Repair / Reuse`, `Scrap`, `Manual Inspection Required`.

## Inventory

`GET /api/inventory`

Manager-only stock overview.

`GET /api/inventory/pending-verification`

Manager-only handling tasks confirmed by employees.

`POST /api/inventory/verify/:taskId`

Manager-only. Executes a PostgreSQL transaction, locks the task and stock row, inserts one stock movement, updates balances, and completes the request. Duplicate verification returns the existing movement and does not deduct stock again.

`GET /api/inventory/movements?search=PCB`

Manager-only stock movement history.

## Analytics

`GET /api/analytics/summary`

Manager-only dashboard cards.

`GET /api/analytics/trends`

Manager-only chart datasets.

`GET /api/analytics/insights`

Manager-only insight cards.

## Chatbot

`POST /api/chat`

Request:

```json
{ "question": "How many products were scrapped?" }
```

Response:

```json
{ "answer": "0 units have been verified as scrapped." }
```

The assistant uses deterministic, read-only, parameterized backend analytics queries. It cannot modify inventory.

## Notifications

`GET /api/notifications`

Returns notifications for the authenticated user.

`PATCH /api/notifications/:id/read`

Marks one notification as read.
