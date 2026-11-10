const mockTransaction = { LOCK: { UPDATE: 'UPDATE' } };
const mockModels = {
  User: { unscoped: jest.fn(), findByPk: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
  Role: { findOne: jest.fn().mockResolvedValue(null) },
  Staff: { create: jest.fn(), findOne: jest.fn(), findByPk: jest.fn(), findAndCountAll: jest.fn() },
  Department: { findByPk: jest.fn() },
  AuditLog: { create: jest.fn() },
  sequelize: { transaction: jest.fn(async (callback) => callback(mockTransaction)) },
};
mockModels.User.unscoped.mockReturnValue(mockModels.User);

jest.mock('../src/models', () => mockModels);

const request = require('supertest');
const app = require('../src/app');
const tokenService = require('../src/services/token.service');

const admin = { id: 1, status: 'Active', role: { id: 1, name: 'Admin' } };
const doctor = { id: 2, status: 'Active', role: { id: 2, name: 'Doctor' } };
const targetUser = {
  id: 8, email: 'staff@example.com', firstName: 'Ife', lastName: 'Adele', status: 'Active',
  role: { id: 2, name: 'Doctor' }, update: jest.fn(async function update(values) { Object.assign(this, values); }),
};

const staffRecord = (overrides = {}) => {
  const record = {
    id: 5, userId: 8, staffNumber: 'STF-005', departmentId: null, specialization: 'General Medicine', status: 'Active',
    update: jest.fn(async (values) => Object.assign(record, values)),
    toJSON: jest.fn(() => ({
      id: record.id, userId: record.userId, staffNumber: record.staffNumber,
      departmentId: record.departmentId, specialization: record.specialization, status: record.status,
    })),
    ...overrides,
  };
  return record;
};

const tokenFor = (user) => `Bearer ${tokenService.signAccessToken(user)}`;

describe('staff routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModels.User.unscoped.mockReturnValue(mockModels.User);
    mockModels.sequelize.transaction.mockImplementation(async (callback) => callback(mockTransaction));
    tokenService.clearRevocations();
  });

  test('Admin creates a staff profile and audit row', async () => {
    const staff = staffRecord();
    mockModels.User.findByPk.mockResolvedValueOnce(admin).mockResolvedValueOnce(targetUser);
    mockModels.Staff.findOne.mockResolvedValue(null);
    mockModels.Staff.create.mockResolvedValue(staff);
    mockModels.Staff.findByPk.mockResolvedValue({ ...staff, user: targetUser, department: null });

    const response = await request(app).post('/api/v1/staff').set('Authorization', tokenFor(admin)).send({
      userId: 8, staffNumber: 'STF-005', specialization: 'General Medicine',
    });
    expect(response.status).toBe(201);
    expect(response.body.data.staffNumber).toBe('STF-005');
    expect(mockModels.AuditLog.create).toHaveBeenCalled();
  });

  test('Doctor cannot create a staff profile', async () => {
    mockModels.User.findByPk.mockResolvedValue(doctor);
    const response = await request(app).post('/api/v1/staff').set('Authorization', tokenFor(doctor)).send({
      userId: 8, staffNumber: 'STF-005',
    });
    expect(response.status).toBe(403);
  });

  test('lists staff with pagination', async () => {
    mockModels.User.findByPk.mockResolvedValue(doctor);
    mockModels.Staff.findAndCountAll.mockResolvedValue({ count: 1, rows: [staffRecord()] });
    const response = await request(app).get('/api/v1/staff?page=1&limit=10&role=Doctor')
      .set('Authorization', tokenFor(doctor));
    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toEqual({ page: 1, limit: 10, total: 1, pages: 1 });
  });

  test('returns a staff profile by staff number', async () => {
    mockModels.User.findByPk.mockResolvedValue(doctor);
    mockModels.Staff.findOne.mockResolvedValue(staffRecord());
    const response = await request(app).get('/api/v1/staff/STF-005').set('Authorization', tokenFor(doctor));
    expect(response.status).toBe(200);
  });

  test('Admin updates a staff profile', async () => {
    const staff = staffRecord();
    mockModels.User.findByPk.mockResolvedValue(admin);
    mockModels.Staff.findOne.mockResolvedValue(staff);
    mockModels.Staff.findByPk.mockResolvedValue(staff);
    const response = await request(app).put('/api/v1/staff/5').set('Authorization', tokenFor(admin))
      .send({ specialization: 'Cardiology' });
    expect(response.status).toBe(200);
    expect(staff.specialization).toBe('Cardiology');
    expect(mockModels.AuditLog.create).toHaveBeenCalled();
  });

  test('Admin deactivates both staff profile and login account', async () => {
    const staff = staffRecord();
    const account = { ...targetUser, update: jest.fn(async (values) => Object.assign(account, values)) };
    mockModels.User.findByPk.mockResolvedValueOnce(admin).mockResolvedValueOnce(account);
    mockModels.Staff.findOne.mockResolvedValue(staff);
    mockModels.Staff.findByPk.mockResolvedValue(staff);
    const response = await request(app).patch('/api/v1/staff/5/status').set('Authorization', tokenFor(admin))
      .send({ status: 'Inactive' });
    expect(response.status).toBe(200);
    expect(staff.status).toBe('Inactive');
    expect(account.status).toBe('Inactive');
  });
});
