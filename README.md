# Light Shade Hospital HMS Backend

Node.js, Express, Sequelize, and MySQL backend for the Light Shade Hospital Management System.

## Local setup (XAMPP)

Prerequisites: Node.js LTS, npm, and XAMPP with MySQL running on `127.0.0.1:3306`.

1. Start MySQL from the XAMPP control panel.
2. Create an empty database named `light_shade_hms` using phpMyAdmin or MySQL.
3. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell) and set
   `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` to your XAMPP credentials.
   Replace `JWT_SECRET` with a long random value. Leave `NODE_ENV=development` for local use.
4. Install packages with `npm ci`.
5. Run `npm run migrate` and then `npm run seed`.
6. Start the API with `npm run dev` (or `npm start`).

The health check is available at `GET http://localhost:3000/api/v1/health`.

Run route tests with `npm test`. The suite uses Jest and Supertest with mocked models, so a
running MySQL server is not needed for unit and route tests. To verify the database setup, run
`npm run migrate` and `npm run seed` against the empty local database, then request the health
endpoint. The seed command adds local development users and roles; do not run it against production.

The [OpenAPI 3 specification](docs/openapi.yaml) covers all HTTP endpoints, request fields,
filters, roles, and standard response shapes. Import it into Postman or an OpenAPI viewer. All
protected endpoints need `Authorization: Bearer <token>` from `/api/v1/auth/login`.

Example smoke check in PowerShell after starting the API:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/auth/login -ContentType 'application/json' -Body '{"email":"admin@lightshade.local","password":"Password123!"}'
Invoke-RestMethod -Uri http://localhost:3000/api/v1/dashboard/stats -Headers @{ Authorization = "Bearer $($login.data.token)" }
```

On successful startup, the terminal displays the MySQL user, host, port, and database name. Database
passwords are never printed.

## Milestone status

- [x] Milestone 0 — Project Setup & Schema
- [x] Milestone 1 — Auth & Role-Based Access
- [x] Milestone 2 — Patient Management
- [x] Milestone 3 — Staff Management
- [x] Milestone 4 — Department Management
- [x] Milestone 5 — Appointment Management
- [x] Milestone 6 — Notifications (Realtime)
- [x] Milestone 7 — Dashboard Aggregation Endpoints
- [x] Milestone 8 — Audit Logging & Non-Functional Requirements
- [x] Milestone 9 — Testing & Handover Prep

A milestone is checked only after its migrations, route tests, and definition of done pass.

## Development accounts

After `npm run seed`, the following local-only accounts are available. Change or remove them before
using a production environment.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@lightshade.local` | `Password123!` |
| Doctor | `doctor@lightshade.local` | `Password123!` |
| Nurse | `nurse@lightshade.local` | `Password123!` |
| Receptionist | `receptionist@lightshade.local` | `Password123!` |

## Authentication endpoints

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout` (Bearer token required)
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/users` (Admin only)

Access tokens expire after 30 minutes. Logout revocation is held in process memory for this MVP, so
revocations reset when the API process restarts.

## Patient endpoints

All patient endpoints require a Bearer access token.

- `POST /api/v1/patients` — Admin, Receptionist
- `GET /api/v1/patients?page=&limit=&search=&status=&registeredFrom=&registeredTo=` — all roles
- `GET /api/v1/patients/:id` — all roles; accepts a numeric ID or `LSH-XXX` number
- `PUT /api/v1/patients/:id` — Admin, Receptionist
- `PATCH /api/v1/patients/:id/status` — Admin, Doctor, Nurse
- `POST /api/v1/patients/:id/visits` — Admin, Doctor, Nurse

## Staff endpoints

All staff endpoints require a Bearer access token.

- `POST /api/v1/staff` — Admin; links an existing user account to a staff profile
- `GET /api/v1/staff?page=&limit=&search=&role=&departmentId=&status=` — all roles
- `GET /api/v1/staff/:id` — all roles; accepts a numeric ID or staff number
- `PUT /api/v1/staff/:id` — Admin
- `PATCH /api/v1/staff/:id/status` — Admin; synchronizes the linked user's login status

## Department endpoints

All department endpoints require a Bearer access token.

- `POST /api/v1/departments` — Admin
- `GET /api/v1/departments?page=&limit=&search=&status=` — all roles; includes live staff count and assigned Doctors
- `PUT /api/v1/departments/:id` — Admin
- `POST /api/v1/departments/:id/assign-staff` — Admin
- `DELETE /api/v1/departments/:id/staff/:staffId` — Admin
- `PATCH /api/v1/departments/:id/capacity` — Admin

## Appointment endpoints

All appointment endpoints require a Bearer access token.

- `POST /api/v1/appointments` — Admin, Receptionist
- `GET /api/v1/appointments?page=&limit=&search=&date=&doctorId=&departmentId=&status=` — all roles
- `GET /api/v1/appointments/today` — all roles; uses the Africa/Lagos calendar date
- `PATCH /api/v1/appointments/:id/reschedule` — Admin, Receptionist; reason required
- `PATCH /api/v1/appointments/:id/cancel` — Admin, Doctor, Receptionist; reason required
- `PATCH /api/v1/appointments/:id/status` — Admin, Doctor, Nurse

Doctor slots are protected by the database unique constraint `appointments_active_slot_unique`.
Cancelling an appointment releases its slot; all other statuses continue to reserve it.

## Notification endpoints and realtime events

- `GET /api/v1/notifications?page=&limit=&search=&isRead=&type=` — current user's notifications and unread count
- `PATCH /api/v1/notifications/:id/read` — mark the current user's notification read

Connect Socket.IO to the API URL with the access token in `auth.token` (or an Authorization header).
Authenticated sockets join `user:{userId}`; Doctors also join `doctor:{staffId}`. Client events are:

- `socket:ready` — confirms the authenticated private room connection
- `notification:new` — persisted notification for the connected user
- `notification:read` — full notification with `isRead: true` and `readAt`, sent to all of the owner's connected sessions after the read transaction commits
- `appointment:booked` — sent only to the assigned Doctor's private room
- `appointment:status_changed` — sent to the assigned Doctor, booking creator and Admins

Booking notifies the assigned Doctor and active Admins. Rescheduling and status changes (including
cancellation) notify the Doctor, booking creator and active Admins, with duplicate recipients removed.
Admins also receive patient registration/status and staff creation/status alerts.

The inbox response is `{ success: true, data: { items, unreadCount, pagination }, error: null }`.
`unreadCount` counts all unread notifications for the signed-in user, regardless of list filters.
Marking read accepts an empty body or `{}` and returns the full notification in `data`; repeating it
preserves the original `readAt`. Missing or another user's notification returns 404. Both routes
require a Bearer token and support all four roles.

Published response examples: [Postman notification documentation](https://documenter.getpostman.com/view/24524544/2sBY4Qszdn).
Sanitized copies are saved in `tests/fixtures/notification-examples.json` and checked by route tests.
Some Doctor requests in that collection use relative `/notifications` paths; use the full
`http://localhost:3000/api/v1/notifications` URL against this API. On socket reconnect, reload the
inbox to recover notifications persisted while offline. When receiving `notification:new` or
`notification:read`, refresh the inbox/unread count; identify items by ID to avoid duplicates.

## Dashboard endpoints and realtime event

- `GET /api/v1/dashboard/stats` — Patient/Staff totals, non-cancelled appointments today, and revenue placeholder
- `GET /api/v1/dashboard/chart` — trailing 12-month patient inflow with zero lab/revenue placeholders
- `GET /api/v1/dashboard/today-appointments?page=&limit=&search=&status=` — today's detailed appointment list
- `dashboard:stats_updated` — pushed to authenticated sockets after relevant Patient, Staff, or Appointment mutations

Patient and Staff percentage changes compare registrations in the latest 30-day window with the
preceding 30 days. Today's appointment percentage compares with yesterday. Dates use Africa/Lagos.

## Security and audit controls

- Successful create, update, and delete operations are recorded in `audit_logs`. Detailed controller
  audits retain before/after values inside the business transaction; `auditLogger.js` provides a
  centralized fallback so a newly added mutating route cannot silently omit its audit row.
- Authentication routes are limited to 10 requests per 15 minutes per client by default. Configure
  this with `AUTH_RATE_LIMIT_MAX` and `AUTH_RATE_LIMIT_WINDOW_MS`.
- Production requests require HTTPS by default. Deploy behind a trusted TLS-terminating reverse proxy
  that sends `X-Forwarded-Proto: https`, or explicitly set `ENFORCE_HTTPS=false` only when TLS is
  enforced by another trusted network layer.
