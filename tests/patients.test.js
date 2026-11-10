const mockTransaction = { LOCK: { UPDATE: 'UPDATE' } };
const mockModels = {
  User: { unscoped: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
  Role: { findOne: jest.fn().mockResolvedValue(null) },
  Patient: { create: jest.fn(), findAndCountAll: jest.fn(), findOne: jest.fn() },
  PatientVisit: { create: jest.fn() },
  Staff: { findOne: jest.fn() },
  AuditLog: { create: jest.fn() },
  sequelize: { transaction: jest.fn(async (callback) => callback(mockTransaction)) },
};
mockModels.User.unscoped.mockReturnValue(mockModels.User);
mockModels.User.findByPk = jest.fn();

jest.mock('../src/models', () => mockModels);

const request = require('supertest');
const app = require('../src/app');
const tokenService = require('../src/services/token.service');

const users = {
  Admin: { id: 1, status: 'Active', role: { id: 1, name: 'Admin' } },
  Doctor: { id: 2, status: 'Active', role: { id: 2, name: 'Doctor' } },
  Receptionist: { id: 4, status: 'Active', role: { id: 4, name: 'Receptionist' } },
};

const authenticateAs = (role) => {
  mockModels.User.findByPk.mockResolvedValue(users[role]);
  return `Bearer ${tokenService.signAccessToken(users[role])}`;
};

const patientRecord = (overrides = {}) => {
  const record = {
    id: 7,
    patientNumber: 'TMP-test',
    firstName: 'Ada',
    lastName: 'Okoro',
    status: 'Active',
    update: jest.fn(async (values) => Object.assign(record, values)),
    toJSON: jest.fn(() => ({
      id: record.id, patientNumber: record.patientNumber, firstName: record.firstName,
      lastName: record.lastName, status: record.status,
    })),
    ...overrides,
  };
  return record;
};

describe('patient routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModels.User.unscoped.mockReturnValue(mockModels.User);
    mockModels.sequelize.transaction.mockImplementation(async (callback) => callback(mockTransaction));
    tokenService.clearRevocations();
  });

  test('Receptionist registers a patient with an LSH number and audit log', async () => {
    const patient = patientRecord();
    mockModels.Patient.create.mockResolvedValue(patient);
    mockModels.AuditLog.create.mockResolvedValue({});

    const response = await request(app).post('/api/v1/patients')
      .set('Authorization', authenticateAs('Receptionist'))
      .send({ firstName: 'Ada', lastName: 'Okoro', phone: '08012345678' });

    expect(response.status).toBe(201);
    expect(response.body.data.patientNumber).toBe('LSH-007');
    expect(mockModels.AuditLog.create).toHaveBeenCalled();
  });

  test('Doctor cannot edit patient demographics', async () => {
    const response = await request(app).put('/api/v1/patients/7')
      .set('Authorization', authenticateAs('Doctor'))
      .send({ firstName: 'Changed' });
    expect(response.status).toBe(403);
  });

  test('lists patients with pagination', async () => {
    mockModels.Patient.findAndCountAll.mockResolvedValue({ count: 1, rows: [patientRecord()] });
    const response = await request(app).get('/api/v1/patients?page=1&limit=10&search=Ada')
      .set('Authorization', authenticateAs('Doctor'));
    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toEqual({ page: 1, limit: 10, total: 1, pages: 1 });
  });

  test('returns a full patient profile', async () => {
    mockModels.Patient.findOne.mockResolvedValue({ ...patientRecord(), visits: [] });
    const response = await request(app).get('/api/v1/patients/LSH-007')
      .set('Authorization', authenticateAs('Doctor'));
    expect(response.status).toBe(200);
  });

  test('Admin updates patient demographics and writes audit log', async () => {
    const patient = patientRecord();
    mockModels.Patient.findOne.mockResolvedValue(patient);
    const response = await request(app).put('/api/v1/patients/7')
      .set('Authorization', authenticateAs('Admin'))
      .send({ firstName: 'Adanna' });
    expect(response.status).toBe(200);
    expect(patient.firstName).toBe('Adanna');
    expect(mockModels.AuditLog.create).toHaveBeenCalled();
  });

  test('Doctor changes patient status', async () => {
    const patient = patientRecord();
    mockModels.Patient.findOne.mockResolvedValue(patient);
    const response = await request(app).patch('/api/v1/patients/7/status')
      .set('Authorization', authenticateAs('Doctor'))
      .send({ status: 'Admitted' });
    expect(response.status).toBe(200);
    expect(patient.status).toBe('Admitted');
  });

  test('Doctor adds a visit log and audit entry', async () => {
    const patient = patientRecord();
    const visit = { id: 3, patientId: 7, reason: 'Review', toJSON: () => ({ id: 3, patientId: 7, reason: 'Review' }) };
    mockModels.Patient.findOne.mockResolvedValue(patient);
    mockModels.Staff.findOne.mockResolvedValue({ id: 2 });
    mockModels.PatientVisit.create.mockResolvedValue(visit);
    const response = await request(app).post('/api/v1/patients/7/visits')
      .set('Authorization', authenticateAs('Doctor'))
      .send({ reason: 'Review', diagnosis: 'Stable' });
    expect(response.status).toBe(201);
    expect(response.body.data.reason).toBe('Review');
    expect(mockModels.AuditLog.create).toHaveBeenCalled();
  });
});
