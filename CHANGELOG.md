# Changelog

## Unreleased

### Notification flow completion - 2026-11-03

- Verified Admin and Doctor list/read response envelopes against the updated public Postman samples; saved sanitized response-only fixtures and regression tests.
- Added private `notification:read` Socket.IO updates after commit so the owner's connected sessions can synchronize read state.
- Completed reschedule notifications for the assigned Doctor and booking creator alongside Admins, deduplicating recipients and persisting inside the appointment transaction.
- Added authentication, filter validation, repeated-read and private socket delivery coverage; documented inbox filters, unread-count semantics and reconnect handling.
- Endpoints remain `GET /api/v1/notifications` and `PATCH /api/v1/notifications/:id/read`; no schema changes or migrations required. Assumption: reschedule alerts use the existing `notification:new` event with type `APPOINTMENT_RESCHEDULED`.

### Admin notifications

- Added authenticated admin inbox alerts for patient registration/status changes, staff additions/status changes, and appointment booking/rescheduling/status changes.
- Added `isRead` and `type` filters to `GET /api/v1/notifications`; notifications remain scoped to the signed-in user and unread counts remain per user.
- Admin alerts are persisted in the existing notifications table and emitted to the admin's `user:<id>` Socket.IO room after the mutation transaction commits.

## 1.0.0 - 2026-09-16

### Milestone 9 — Testing & Handover Prep ✅ Done

- Added an OpenAPI 3 specification for every HTTP route, including authentication, role access,
  request fields, list filters, and the standard response envelope.
- Expanded the local XAMPP setup instructions with environment variables, clean installation,
  migration/seed steps, and a PowerShell smoke check.
- Added route tests confirming that all four seeded roles can log in.
- Verified the complete Jest and Supertest suite passes.

#### Handover note

- Route tests mock Sequelize models; a fresh local MySQL migration and seed remain the database
  smoke check for a new environment.

## 0.9.0 - 2026-09-14

### Milestone 8 — Audit Logging & Non-Functional Requirements ✅ Done

- Added centralized audit middleware covering every successful create, update, and delete route.
- Preserved transaction-safe detailed before/after audits and added fallback auditing for future
  mutating handlers that omit an explicit audit call.
- Added a global error handler with consistent API responses and Sequelize error classification.
- Added per-client rate limiting across authentication routes with standard rate-limit headers.
- Added production HTTPS enforcement with trusted reverse-proxy support and environment controls.
- Added middleware tests for audit enforcement, duplicate prevention, unsuccessful mutations,
  global error formatting, and production HTTPS handling.

#### Security configuration

- Authentication limits default to 10 requests per 15 minutes. Production HTTPS enforcement is on
  unless `ENFORCE_HTTPS=false`; local development and test traffic remain HTTP-compatible.

#### Schema note

- No migration was required because `audit_logs` and its lookup index already exist in the core schema.

## 0.8.0 - 2026-08-28

### Milestone 7 — Dashboard Aggregation Endpoints ✅ Done

- Added total Patient, total Staff, appointments-today, and revenue-placeholder KPIs.
- Added percentage changes using documented prior periods.
- Added a trailing 12-month patient-inflow chart with lab/revenue zero placeholders.
- Added a paginated, searchable, status-filterable today-appointments endpoint.
- Added authenticated dashboard socket rooms and `dashboard:stats_updated` pushes after relevant mutations.
- Added route and realtime tests and verified endpoint values against direct fresh-MySQL counts.

#### Trend-period assumption

- Patient and Staff trends compare records created in the latest 30 days against the preceding
  30 days. Appointment trends compare today with yesterday. A non-zero current value over a zero
  prior value reports `100%`; two zero values report `0%`.

#### Placeholder note

- Revenue and lab-test chart values remain zero placeholders because billing and laboratory modules
  are explicitly out of scope. Revenue is labelled as NGN and `placeholder: true`.

#### Schema note

- No Milestone 7 migration was required; all aggregations use existing core tables.

## 0.7.0 - 2026-08-28

### Milestone 6 — Notifications (Realtime) ✅ Done

- Added Socket.IO beside Express on the same HTTP server.
- Added JWT authentication for sockets and private user/Doctor rooms.
- Persisted a notification and pushed `appointment:booked` only to the assigned Doctor after booking commits.
- Persisted and pushed appointment status changes to the assigned Doctor and booking creator.
- Added paginated notification listing with an unread count.
- Added mark-as-read with ownership enforcement and audit logging.
- Added HTTP route tests and a two-Doctor Socket.IO isolation integration test.
- Verified on fresh MySQL that the assigned Doctor received the event and unread row while the other Doctor did not.

#### Realtime assumption

- Patients do not have user accounts in the MVP schema, so appointment status notifications go to
  the assigned Doctor and the staff user who created the appointment. Patient-facing delivery remains
  out of scope until patient accounts or an approved external messaging integration exist.

#### Schema note

- No Milestone 6 migration was required because the core migration already included the notifications table.

## 0.6.0 - 2026-08-26

### Milestone 5 — Appointment Management ✅ Done

- Added appointment booking with patient, active Doctor, and active department validation.
- Added a database-level unique active-slot constraint that prevents concurrent Doctor double-booking.
- Added paginated appointment search and date/Doctor/department/status filters.
- Added the Africa/Lagos `today` appointment endpoint.
- Added rescheduling and cancellation with mandatory reasons and transactional audit logs.
- Added Pending, Confirmed, Completed, Cancelled, and No-Show status management.
- Added route coverage and verified 30 concurrent real-MySQL attempts produced exactly one booking.
- Verified cancellation releases a slot so it can be booked again.

#### Role-policy assumption

- Admin and Receptionist may book and reschedule appointments. Admin, Doctor, and Receptionist may
  cancel with a reason. Admin, Doctor, and Nurse may update appointment status. All authenticated
  hospital roles may view appointment lists. The referenced PRD Section 3 is unavailable locally.

#### Conflict-policy assumption

- Pending, Confirmed, Completed, and No-Show appointments continue to reserve a Doctor slot;
  only Cancelled appointments release it. The migration backfills protection for existing records.

## 0.5.0 - 2026-08-12

### Milestone 4 — Department Management ✅ Done

- Added Admin-only department creation and editing.
- Added paginated department listing with search/status filters, live staff counts, and assigned Doctor profiles.
- Added staff assignment and removal with transactional audit logging.
- Added capacity management that prevents over-assignment and invalid reductions below current staffing.
- Added Supertest coverage and fresh-database end-to-end verification of counts and Doctor inclusion.

#### Role-policy assumption

- All authenticated hospital roles may read the department directory; only Admin may create or edit
  departments, manage capacity, or change staff assignments.

#### Capacity assumption

- A capacity of `0` means no configured limit. Any positive capacity is enforced during assignment,
  and cannot be reduced below the department's current live staff count.

#### Schema note

- No Milestone 4 migration was necessary because the initial core migration already contained all
  required department and staff-assignment fields and constraints.

## 0.4.0 - 2026-07-31

### Milestone 3 — Staff Management ✅ Done

- Added Admin-only staff profile creation linked to existing user accounts.
- Added paginated staff search and filters for role, department, and status.
- Added staff detail retrieval by database ID or staff number.
- Added Admin-only profile editing and Active/Inactive status management.
- Synchronized staff deactivation with the linked user account and denied inactive staff login.
- Added audit rows for every staff mutation.
- Added Supertest coverage and fresh-database end-to-end verification.

#### Role-policy assumption

- All authenticated hospital roles may read staff directory data; only Admin may create, edit, or
  activate/deactivate staff. Staff creation links an account previously created through the Admin-only
  auth user endpoint.

#### Schema note

- No Milestone 3 migration was necessary because the initial core migration already contained all
  required staff fields and constraints.

## 0.3.0 - 2026-07-24

### Milestone 2 — Patient Management ✅ Done

- Added patient registration with transaction-safe `LSH-XXX` numbers based on database IDs.
- Added paginated patient search by name, patient number, or phone and status/date filtering.
- Added patient profiles with ordered visit history.
- Added demographic editing, clinical status changes, and patient visit logging.
- Added the `patient_visits` migration and model with staff/user attribution.
- Added audit rows for every patient and visit mutation.
- Added Supertest coverage and verified 20 concurrent real API registrations generated 20 unique numbers.

#### Role-policy assumption

- Admin and Receptionist manage patient demographics; all roles may view patient records; Admin,
  Doctor, and Nurse may change clinical status and add visit logs. The referenced PRD Section 3 was
  not present in the repository, so this is the smallest conventional HMS access policy.

## 0.2.0 - 2026-07-24

### Milestone 1 — Auth & Role-Based Access ✅ Done

- Added login with bcrypt password verification and 30-minute JWT access tokens.
- Added authenticated logout with token revocation.
- Added a non-enumerating password-reset request endpoint with console-based email stub.
- Added Admin-only user creation with role assignment and audit logging.
- Added authentication, role authorization, and request-validation middleware.
- Added development seed accounts for Admin, Doctor, Nurse, and Receptionist.
- Added Supertest coverage for login, invalid credentials, missing and expired tokens, logout,
  reset requests, role denial, Admin user creation, and audit creation.
- Made role and development-user seeders safe to run against databases containing some or all seed records.

#### Assumption

- Logout revocations use an in-memory store for the MVP. They do not survive process restarts or
  synchronize across multiple API processes; persistent session revocation can be introduced with
  infrastructure intended for multi-instance deployment.

## 0.1.0 - 2026-07-24

### Milestone 0 — Project Setup & Schema ✅ Done

- Added the Express application and versioned health endpoint.
- Added environment-driven Sequelize/MySQL configuration for local XAMPP.
- Added the core roles, users, patients, staff, departments, appointments, notifications, and audit log schema with Sequelize models and migration.
- Added seed data for Admin, Doctor, Nurse, and Receptionist roles.
- Added Jest/Supertest coverage for the health endpoint.
- Added a safe startup message showing the connected MySQL user, host, port, and database name.
