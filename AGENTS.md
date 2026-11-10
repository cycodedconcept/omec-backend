# AGENTS.md — Light Shade Hospital HMS (Backend Only)

## 0. Context for the Agent

You are building the **backend only** for the Light Shade Hospital Management System (HMS) MVP.
There is no frontend work in this repo. Ignore any frontend-related sections of the original PRD.

**Important deviation from the original PRD:** The PRD (Section 6) specifies Supabase as the backend
platform. That decision has been reversed. This project uses a **custom Node.js + Express API** with
a **local MySQL database (via XAMPP)**. Wherever the PRD references Supabase Auth, Row Level
Security (RLS), Supabase Realtime, or Supabase Storage, build the equivalent yourself using the stack
below. Do not attempt to install or configure Supabase anything.

---

## 1. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js (LTS) | |
| Framework | Express.js | REST API |
| Database | MySQL (via local XAMPP) | Connect to `127.0.0.1:3306` |
| ORM | Sequelize | Migrations + models. Swap to Knex only if explicitly told to. |
| Auth | `jsonwebtoken` + `bcrypt` | Custom JWT auth replaces Supabase Auth |
| Access Control | Custom Express middleware | Replaces Supabase RLS — enforce role checks per route, not in the DB |
| Realtime | `socket.io` | Replaces Supabase Realtime — used for dashboard KPIs and notifications |
| Validation | `express-validator` or `joi` | Validate all request bodies |
| Env Config | `dotenv` | Never commit `.env` |
| Testing | `jest` + `supertest` | Every module needs at least basic route tests |
| Logging | `winston` or `morgan` (dev) | Plus a custom `audit_logs` table (see Milestone 8) |

---

## 2. Folder Structure (target)

```
/src
  /config        # db.js, env loader, socket setup
  /models        # Sequelize models
  /migrations    # Sequelize migrations
  /seeders       # Seed data for local dev (roles, sample departments)
  /controllers
  /routes
  /middleware    # auth.js, roleCheck.js, auditLogger.js, errorHandler.js
  /services      # business logic (conflict check, notification dispatch, etc.)
  /validators
  /utils
  server.js
```

---

## 3. Conventions

- REST endpoints only, versioned under `/api/v1/...`
- Response shape, always: `{ "success": boolean, "data": any, "error": string|null }`
- All list endpoints support `?page=&limit=&search=` pagination/filtering
- Passwords: bcrypt, min 10 salt rounds
- JWT: access token expiry matches PRD's 30-minute session timeout (Section 4.1)
- All protected routes go through `auth.js` (verifies JWT) then `roleCheck.js` (verifies role permission)
- Every create/update/delete action must write an entry to `audit_logs` (user id, action, table, record id, timestamp)
- Write a migration for every schema change — no manual DB edits outside migrations
- Write a Jest test for every new route before marking a milestone done

---

## 4. Backend Milestones

Work through these in order. Each milestone should end with: migrations run cleanly on a fresh
local MySQL DB, routes tested with Supertest, and a short note in `CHANGELOG.md` of what shipped.

### Milestone 0 — Project Setup & Schema
- Init Express app, folder structure, `.env.example`, `dotenv` config
- Connect Sequelize to local MySQL (XAMPP)
- Define core schema/migrations for: `users`, `roles`, `patients`, `staff`, `departments`,
  `appointments`, `notifications`, `audit_logs`
- Seed script for the 4 roles: Admin, Doctor, Nurse, Receptionist
- **DoD:** `npm run migrate` and `npm run seed` succeed on a clean local DB; `GET /api/v1/health` returns 200

### Milestone 1 — Auth & Role-Based Access
- `POST /auth/login` (email + password → JWT)
- `POST /auth/logout`
- `POST /auth/reset-password` (email-link flow — stub email sending for now, log link to console)
- `POST /auth/users` (Admin only — create user + assign role)
- Middleware: `auth.js` (verify JWT), `roleCheck.js(allowedRoles)`
- 30-minute session/token expiry
- **DoD:** each of the 4 roles can log in; protected route returns 403 for wrong role, 401 for no/expired token

### Milestone 2 — Patient Management
- `POST /patients` — register (auto-generate `LSH-XXX` ID)
- `GET /patients` — paginated, search by name/ID/phone, filter by status/date
- `GET /patients/:id` — full profile + visit history
- `PUT /patients/:id` — edit
- `PATCH /patients/:id/status` — Active/Admitted/Discharged (restricted roles)
- `POST /patients/:id/visits` — add visit log entry
- **DoD:** conflict-free `LSH-XXX` generation under concurrent requests; role restrictions match Section 3 of the PRD

### Milestone 3 — Staff Management
- `POST /staff`, `GET /staff` (search/filter by role & department), `GET /staff/:id`, `PUT /staff/:id`
- `PATCH /staff/:id/status` — Active/Inactive (Admin only)
- **DoD:** deactivated staff cannot log in (check in Milestone 1's auth flow)

### Milestone 4 — Department Management
- `POST /departments`, `GET /departments` (with staff count), `PUT /departments/:id`
- `POST /departments/:id/assign-staff`, `DELETE /departments/:id/staff/:staffId`
- `PATCH /departments/:id/capacity`
- **DoD:** department list response includes live staff count and assigned doctors

### Milestone 5 — Appointment Management
- `POST /appointments` — book (patient, doctor, department, date, time)
- **Doctor conflict check is critical**: reject if the doctor already has a non-cancelled
  appointment in the same time slot (add a DB-level unique constraint or transaction-safe check,
  not just an app-level check)
- `GET /appointments` — filter by date/doctor/department/status
- `GET /appointments/today`
- `PATCH /appointments/:id/reschedule` (requires reason)
- `PATCH /appointments/:id/cancel` (requires reason, logged)
- `PATCH /appointments/:id/status` — Pending/Confirmed/Completed/Cancelled/No-Show
- **DoD:** load-test the conflict check with concurrent booking attempts for the same slot — must never double-book

### Milestone 6 — Notifications (Realtime)
- Set up `socket.io` server alongside Express
- Emit event on new appointment booking → notify assigned doctor's room/channel
- Emit event on appointment status change → notify relevant parties
- `GET /notifications` — list with unread count
- `PATCH /notifications/:id/read`
- **DoD:** connecting a client socket and booking an appointment triggers a real-time push to the correct doctor only

### Milestone 7 — Dashboard Aggregation Endpoints
- `GET /dashboard/stats` — total patients, total staff, appointments today, revenue today (stub
  revenue as 0 or from a simple `payments` placeholder table since billing is Phase 2), each with
  % change vs prior period
- `GET /dashboard/chart` — monthly patient inflow / lab test count / revenue (lab & revenue can
  return zeros/placeholders — those modules are Phase 2)
- `GET /dashboard/today-appointments`
- Push stat updates over the same `socket.io` connection so a connected dashboard updates live
- **DoD:** stats match manual counts against seeded test data

### Milestone 8 — Audit Logging & Non-Functional Requirements
- `auditLogger.js` middleware: auto-log all create/update/delete actions to `audit_logs`
  (user id, action, table, record id, before/after if feasible, timestamp)
- Global error handler with consistent error response shape
- Rate limiting (`express-rate-limit`) on auth routes
- HTTPS note: enforce in production config (not needed for local XAMPP dev)
- **DoD:** every mutating action across all modules produces an audit log row

### Milestone 9 — Testing & Handover Prep
- Fill test coverage gaps across all modules (Jest + Supertest)
- Write a Postman collection or OpenAPI spec covering every endpoint
- README with local setup steps (XAMPP MySQL creds, `.env` vars, migrate/seed commands)
- **DoD:** a new developer can clone the repo, follow the README, and have a fully working local API in under 15 minutes

---

## 5. Explicitly Out of Scope (per PRD Section 1 & 12)

Do not build: laboratory management, billing/invoicing/payments, prescriptions, insurance/claims,
document uploads, SMS/email integrations, advanced analytics, multi-branch support. These are
Phase 2/3. If a milestone needs a placeholder for one of these (e.g. revenue in the dashboard),
stub it rather than building the real feature.

Also out of scope for this repo: any React/frontend code, Supabase configuration of any kind.

---

## 6. Working Agreement for the Agent

- Work milestone by milestone, in order. Don't jump ahead.
- After finishing a milestone, summarize what was built, list new/changed endpoints, and note any
  deviations from this file before moving to the next milestone.
- If a requirement is ambiguous, make the smallest reasonable assumption consistent with the PRD's
  role/access rules (Section 3) and note the assumption in the milestone summary rather than stalling.
- Never touch Supabase-related setup — this project does not use it.