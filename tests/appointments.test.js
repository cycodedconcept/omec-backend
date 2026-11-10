const mockTransaction = { LOCK: { UPDATE: 'UPDATE' } };
const mockModels = {
  User: { unscoped: jest.fn(), findByPk: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
  Role: { findOne: jest.fn().mockResolvedValue(null) },
  Patient: { findByPk: jest.fn() },
  Staff: { findByPk: jest.fn() },
  Department: { findByPk: jest.fn() },
  Appointment: { create: jest.fn(), findByPk: jest.fn(), findAndCountAll: jest.fn() },
  Notification: { create: jest.fn() },
  AuditLog: { create: jest.fn() },
  sequelize: { transaction: jest.fn(async (callback) => callback(mockTransaction)) },
};
mockModels.User.unscoped.mockReturnValue(mockModels.User);

jest.mock('../src/models', () => mockModels);

const request = require('supertest');
const app = require('../src/app');
const tokenService = require('../src/services/token.service');

const users = {
  Admin: { id: 1, status: 'Active', role: { id: 1, name: 'Admin' } },
  Doctor: { id: 2, status: 'Active', role: { id: 2, name: 'Doctor' } },
  Receptionist: { id: 4, status: 'Active', role: { id: 4, name: 'Receptionist' } },
};
const tokenFor = (user) => `Bearer ${tokenService.signAccessToken(user)}`;

const appointmentRecord = (overrides = {}) => {
  const record = {
    id: 9, patientId: 7, doctorId: 5, departmentId: 3,
    appointmentDate: '2026-09-01', appointmentTime: '10:00:00',
    slotKey: '5|2026-09-01|10:00:00', reason: 'Review', status: 'Pending',
    cancellationReason: null, rescheduleReason: null, createdBy: 4,
    update: jest.fn(async (values) => Object.assign(record, values)),
    toJSON: jest.fn(() => ({
      id: record.id, patientId: record.patientId, doctorId: record.doctorId,
      departmentId: record.departmentId, appointmentDate: record.appointmentDate,
      appointmentTime: record.appointmentTime, slotKey: record.slotKey, reason: record.reason,
      status: record.status, cancellationReason: record.cancellationReason,
      rescheduleReason: record.rescheduleReason, createdBy: record.createdBy,
    })),
    ...overrides,
  };
  return record;
};

describe('appointment routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModels.User.unscoped.mockReturnValue(mockModels.User);
    mockModels.sequelize.transaction.mockImplementation(async (callback) => callback(mockTransaction));
    tokenService.clearRevocations();
    mockModels.Notification.create.mockImplementation(async (values) => ({ id: 20, ...values }));
  });

  function mockActiveReferences() {
    mockModels.Patient.findByPk.mockResolvedValue({ id: 7 });
    mockModels.Staff.findByPk.mockResolvedValue({
      id: 5, departmentId: 3, status: 'Active',
      user: { status: 'Active', role: { name: 'Doctor' } },
    });
    mockModels.Department.findByPk.mockResolvedValue({ id: 3, status: 'Active' });
  }

  test('Receptionist books an appointment and writes an audit row', async () => {
    mockModels.User.findByPk.mockResolvedValue(users.Receptionist);
    mockActiveReferences();
    const record = appointmentRecord();
    mockModels.Appointment.create.mockResolvedValue(record);
    mockModels.Appointment.findByPk.mockResolvedValue(record);
    const response = await request(app).post('/api/v1/appointments')
      .set('Authorization', tokenFor(users.Receptionist)).send({
        patientId: 7, doctorId: 5, departmentId: 3,
        appointmentDate: '2026-09-01', appointmentTime: '10:00', reason: 'Review',
      });
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('Pending');
    expect(response.body.data).not.toHaveProperty('slotKey');
    expect(mockModels.AuditLog.create).toHaveBeenCalled();
  });

  test('DB unique conflict returns 409', async () => {
    mockModels.User.findByPk.mockResolvedValue(users.Receptionist);
    mockActiveReferences();
    const error = new Error('duplicate');
    error.name = 'SequelizeUniqueConstraintError';
    mockModels.Appointment.create.mockRejectedValue(error);
    const response = await request(app).post('/api/v1/appointments')
      .set('Authorization', tokenFor(users.Receptionist)).send({
        patientId: 7, doctorId: 5, departmentId: 3,
        appointmentDate: '2026-09-01', appointmentTime: '10:00',
      });
    expect(response.status).toBe(409);
    expect(response.body.error).toContain('already has');
  });

  test('Doctor cannot book an appointment', async () => {
    mockModels.User.findByPk.mockResolvedValue(users.Doctor);
    const response = await request(app).post('/api/v1/appointments')
      .set('Authorization', tokenFor(users.Doctor)).send({
        patientId: 7, doctorId: 5, departmentId: 3,
        appointmentDate: '2026-09-01', appointmentTime: '10:00',
      });
    expect(response.status).toBe(403);
  });

  test('lists filtered appointments with pagination', async () => {
    mockModels.User.findByPk.mockResolvedValue(users.Doctor);
    mockModels.Appointment.findAndCountAll.mockResolvedValue({ count: 1, rows: [appointmentRecord()] });
    const response = await request(app).get('/api/v1/appointments?date=2026-09-01&doctorId=5&status=Pending')
      .set('Authorization', tokenFor(users.Doctor));
    expect(response.status).toBe(200);
    expect(response.body.data.pagination.total).toBe(1);
  });

  test('today endpoint returns a paginated list', async () => {
    mockModels.User.findByPk.mockResolvedValue(users.Doctor);
    mockModels.Appointment.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    const response = await request(app).get('/api/v1/appointments/today')
      .set('Authorization', tokenFor(users.Doctor));
    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });

  test('Receptionist reschedules with a required reason', async () => {
    mockModels.User.findByPk.mockResolvedValue(users.Receptionist);
    const record = appointmentRecord();
    mockModels.Appointment.findByPk.mockResolvedValue(record);
    const response = await request(app).patch('/api/v1/appointments/9/reschedule')
      .set('Authorization', tokenFor(users.Receptionist)).send({
        appointmentDate: '2026-09-02', appointmentTime: '11:30', reason: 'Patient requested change',
      });
    expect(response.status).toBe(200);
    expect(record.appointmentDate).toBe('2026-09-02');
    expect(record.rescheduleReason).toBe('Patient requested change');
  });

  test('reschedule without reason is rejected', async () => {
    mockModels.User.findByPk.mockResolvedValue(users.Receptionist);
    const response = await request(app).patch('/api/v1/appointments/9/reschedule')
      .set('Authorization', tokenFor(users.Receptionist)).send({
        appointmentDate: '2026-09-02', appointmentTime: '11:30',
      });
    expect(response.status).toBe(422);
  });

  test('rescheduling persists notifications for the doctor, creator and admins without duplicates', async () => {
    mockModels.User.findByPk.mockResolvedValue(users.Receptionist);
    mockModels.Staff.findByPk.mockResolvedValue({ id: 5, userId: 2 });
    mockModels.Role.findOne.mockResolvedValue({ id: 1 });
    mockModels.User.findAll.mockResolvedValue([{ id: 1 }, { id: 4 }]);
    mockModels.Appointment.findByPk.mockResolvedValue(appointmentRecord());
    const response = await request(app).patch('/api/v1/appointments/9/reschedule')
      .set('Authorization', tokenFor(users.Receptionist)).send({
        appointmentDate: '2026-09-02', appointmentTime: '11:30', reason: 'Patient requested change',
      });
    expect(response.status).toBe(200);
    expect(mockModels.Notification.create.mock.calls.map(([values]) => values.userId).sort()).toEqual([1, 2, 4]);
    mockModels.Notification.create.mock.calls.forEach(([values, options]) => {
      expect(values).toMatchObject({ type: 'APPOINTMENT_RESCHEDULED', relatedType: 'appointment', relatedId: 9 });
      expect(options.transaction).toBe(mockTransaction);
    });
  });

  test('Doctor cancels with a reason and releases the slot', async () => {
    mockModels.User.findByPk.mockResolvedValue(users.Doctor);
    const record = appointmentRecord();
    mockModels.Appointment.findByPk.mockResolvedValue(record);
    const response = await request(app).patch('/api/v1/appointments/9/cancel')
      .set('Authorization', tokenFor(users.Doctor)).send({ reason: 'Doctor unavailable' });
    expect(response.status).toBe(200);
    expect(record.status).toBe('Cancelled');
    expect(record.slotKey).toBeNull();
  });

  test('Nurse is denied cancellation route', async () => {
    const nurse = { id: 3, status: 'Active', role: { id: 3, name: 'Nurse' } };
    mockModels.User.findByPk.mockResolvedValue(nurse);
    const response = await request(app).patch('/api/v1/appointments/9/cancel')
      .set('Authorization', tokenFor(nurse)).send({ reason: 'Test' });
    expect(response.status).toBe(403);
  });

  test('Doctor updates appointment status', async () => {
    mockModels.User.findByPk.mockResolvedValue(users.Doctor);
    const record = appointmentRecord();
    mockModels.Appointment.findByPk.mockResolvedValue(record);
    const response = await request(app).patch('/api/v1/appointments/9/status')
      .set('Authorization', tokenFor(users.Doctor)).send({ status: 'Completed' });
    expect(response.status).toBe(200);
    expect(record.status).toBe('Completed');
  });
});
