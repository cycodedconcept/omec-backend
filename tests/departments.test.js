const mockTransaction = { LOCK: { UPDATE: 'UPDATE' } };
const mockModels = {
  User: { unscoped: jest.fn(), findByPk: jest.fn() },
  Role: {},
  Department: { create: jest.fn(), findByPk: jest.fn(), findAndCountAll: jest.fn() },
  Staff: { findByPk: jest.fn(), findOne: jest.fn(), count: jest.fn() },
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
const tokenFor = (user) => `Bearer ${tokenService.signAccessToken(user)}`;

const departmentRecord = (overrides = {}) => {
  const record = {
    id: 3, name: 'Cardiology', description: null, capacity: 10, status: 'Active', staff: [],
    update: jest.fn(async (values) => Object.assign(record, values)),
    toJSON: jest.fn(() => ({
      id: record.id, name: record.name, description: record.description, capacity: record.capacity,
      status: record.status, staff: record.staff, staffCount: record.staff.length,
    })),
    ...overrides,
  };
  return record;
};

const staffRecord = (overrides = {}) => {
  const record = {
    id: 5, staffNumber: 'DOC-005', departmentId: null, status: 'Active',
    update: jest.fn(async (values) => Object.assign(record, values)),
    ...overrides,
  };
  return record;
};

describe('department routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModels.User.unscoped.mockReturnValue(mockModels.User);
    mockModels.sequelize.transaction.mockImplementation(async (callback) => callback(mockTransaction));
    tokenService.clearRevocations();
  });

  test('Admin creates a department with an audit row', async () => {
    mockModels.User.findByPk.mockResolvedValue(admin);
    mockModels.Department.create.mockResolvedValue(departmentRecord());
    const response = await request(app).post('/api/v1/departments').set('Authorization', tokenFor(admin))
      .send({ name: 'Cardiology', capacity: 10 });
    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe('Cardiology');
    expect(mockModels.AuditLog.create).toHaveBeenCalled();
  });

  test('Doctor cannot create a department', async () => {
    mockModels.User.findByPk.mockResolvedValue(doctor);
    const response = await request(app).post('/api/v1/departments').set('Authorization', tokenFor(doctor))
      .send({ name: 'Cardiology' });
    expect(response.status).toBe(403);
  });

  test('lists departments with staff count and assigned doctors', async () => {
    mockModels.User.findByPk.mockResolvedValue(doctor);
    const department = departmentRecord({ staff: [{ id: 5, user: { role: { name: 'Doctor' } } }] });
    mockModels.Department.findAndCountAll.mockResolvedValue({ count: 1, rows: [department] });
    const response = await request(app).get('/api/v1/departments?page=1&limit=10')
      .set('Authorization', tokenFor(doctor));
    expect(response.status).toBe(200);
    expect(response.body.data.items[0].staffCount).toBe(1);
    expect(response.body.data.items[0].assignedDoctors).toHaveLength(1);
    expect(response.body.data.pagination.total).toBe(1);
  });

  test('Admin edits a department', async () => {
    mockModels.User.findByPk.mockResolvedValue(admin);
    const department = departmentRecord();
    mockModels.Department.findByPk.mockResolvedValue(department);
    const response = await request(app).put('/api/v1/departments/3').set('Authorization', tokenFor(admin))
      .send({ description: 'Heart care' });
    expect(response.status).toBe(200);
    expect(department.description).toBe('Heart care');
  });

  test('Admin assigns staff when capacity is available', async () => {
    mockModels.User.findByPk.mockResolvedValue(admin);
    const department = departmentRecord();
    const staff = staffRecord();
    mockModels.Department.findByPk.mockResolvedValue(department);
    mockModels.Staff.findByPk.mockResolvedValue(staff);
    mockModels.Staff.count.mockResolvedValue(2);
    const response = await request(app).post('/api/v1/departments/3/assign-staff')
      .set('Authorization', tokenFor(admin)).send({ staffId: 5 });
    expect(response.status).toBe(200);
    expect(staff.departmentId).toBe(3);
    expect(mockModels.AuditLog.create).toHaveBeenCalled();
  });

  test('assignment is rejected when department is at capacity', async () => {
    mockModels.User.findByPk.mockResolvedValue(admin);
    mockModels.Department.findByPk.mockResolvedValue(departmentRecord({ capacity: 1 }));
    mockModels.Staff.findByPk.mockResolvedValue(staffRecord());
    mockModels.Staff.count.mockResolvedValue(1);
    const response = await request(app).post('/api/v1/departments/3/assign-staff')
      .set('Authorization', tokenFor(admin)).send({ staffId: 5 });
    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/capacity/);
  });

  test('Admin removes assigned staff', async () => {
    mockModels.User.findByPk.mockResolvedValue(admin);
    const staff = staffRecord({ departmentId: 3 });
    mockModels.Department.findByPk.mockResolvedValue(departmentRecord());
    mockModels.Staff.findOne.mockResolvedValue(staff);
    const response = await request(app).delete('/api/v1/departments/3/staff/5')
      .set('Authorization', tokenFor(admin));
    expect(response.status).toBe(200);
    expect(staff.departmentId).toBeNull();
  });

  test('capacity cannot be lower than current staff count', async () => {
    mockModels.User.findByPk.mockResolvedValue(admin);
    mockModels.Department.findByPk.mockResolvedValue(departmentRecord());
    mockModels.Staff.count.mockResolvedValue(4);
    const response = await request(app).patch('/api/v1/departments/3/capacity')
      .set('Authorization', tokenFor(admin)).send({ capacity: 2 });
    expect(response.status).toBe(409);
    expect(response.body.error).toContain('current staff count');
  });
});
