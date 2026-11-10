process.env.AUTH_RATE_LIMIT_MAX = '1000';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const mockTransaction = { commit: jest.fn(), rollback: jest.fn() };
const mockUser = {
  unscoped: jest.fn(),
  findOne: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
};
mockUser.unscoped.mockReturnValue(mockUser);

jest.mock('../src/models', () => ({
  User: mockUser,
  Role: { findByPk: jest.fn() },
  AuditLog: { create: jest.fn() },
  sequelize: { transaction: jest.fn().mockResolvedValue(mockTransaction) },
}));

const request = require('supertest');
const app = require('../src/app');
const env = require('../src/config/env');
const tokenService = require('../src/services/token.service');
const { Role, AuditLog } = require('../src/models');

const admin = {
  id: 1,
  email: 'admin@lightshade.local',
  passwordHash: '',
  firstName: 'System',
  lastName: 'Admin',
  status: 'Active',
  role: { id: 1, name: 'Admin' },
  update: jest.fn().mockResolvedValue(undefined),
};

describe('authentication routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.unscoped.mockReturnValue(mockUser);
    tokenService.clearRevocations();
    mockTransaction.commit.mockResolvedValue(undefined);
    mockTransaction.rollback.mockResolvedValue(undefined);
  });

  test('POST /api/v1/auth/login returns a 30-minute access token', async () => {
    const user = { ...admin, passwordHash: await bcrypt.hash('Password123!', 10), update: jest.fn() };
    mockUser.findOne.mockResolvedValue(user);

    const response = await request(app).post('/api/v1/auth/login').send({
      email: user.email,
      password: 'Password123!',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.expiresIn).toBe('30m');
    expect(tokenService.verifyToken(response.body.data.token)).toMatchObject({ sub: '1', role: 'Admin', type: 'access' });
  });

  test.each(['Admin', 'Doctor', 'Nurse', 'Receptionist'])('%s can log in with its assigned role', async (roleName) => {
    const user = {
      ...admin,
      email: `${roleName.toLowerCase()}@lightshade.local`,
      role: { id: ['Admin', 'Doctor', 'Nurse', 'Receptionist'].indexOf(roleName) + 1, name: roleName },
      passwordHash: await bcrypt.hash('Password123!', 10),
      update: jest.fn(),
    };
    mockUser.findOne.mockResolvedValue(user);

    const response = await request(app).post('/api/v1/auth/login').send({
      email: user.email,
      password: 'Password123!',
    });

    expect(response.status).toBe(200);
    expect(tokenService.verifyToken(response.body.data.token)).toMatchObject({ role: roleName, type: 'access' });
  });

  test('login rejects invalid credentials', async () => {
    mockUser.findOne.mockResolvedValue(null);
    const response = await request(app).post('/api/v1/auth/login').send({ email: 'none@example.com', password: 'wrong' });
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, data: null, error: 'Invalid email or password' });
  });

  test('login rejects a deactivated staff member', async () => {
    const user = {
      ...admin,
      passwordHash: await bcrypt.hash('Password123!', 10),
      staffProfile: { id: 4, status: 'Inactive' },
    };
    mockUser.findOne.mockResolvedValue(user);
    const response = await request(app).post('/api/v1/auth/login').send({
      email: user.email,
      password: 'Password123!',
    });
    expect(response.status).toBe(401);
  });

  test('a protected route rejects requests without a token', async () => {
    const response = await request(app).post('/api/v1/auth/logout');
    expect(response.status).toBe(401);
  });

  test('a protected route rejects expired tokens', async () => {
    const expired = jwt.sign({ sub: '1', role: 'Admin', type: 'access' }, env.jwt.secret, { expiresIn: -1, jwtid: 'expired-id' });
    const response = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${expired}`);
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Token expired');
  });

  test('logout revokes the presented token', async () => {
    mockUser.findByPk.mockResolvedValue(admin);
    const token = tokenService.signAccessToken(admin);
    const first = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`);
    const second = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(401);
  });

  test('reset-password returns a non-enumerating response', async () => {
    mockUser.findOne.mockResolvedValue(null);
    const response = await request(app).post('/api/v1/auth/reset-password').send({ email: 'unknown@example.com' });
    expect(response.status).toBe(200);
    expect(response.body.data.message).toMatch(/If that email is registered/);
  });

  test('non-admin users receive 403 when creating users', async () => {
    const doctor = { ...admin, role: { id: 2, name: 'Doctor' } };
    mockUser.findByPk.mockResolvedValue(doctor);
    const token = tokenService.signAccessToken(doctor);
    const response = await request(app).post('/api/v1/auth/users').set('Authorization', `Bearer ${token}`).send({
      email: 'new@example.com', password: 'Password123!', firstName: 'New', lastName: 'User', roleId: 2,
    });
    expect(response.status).toBe(403);
  });

  test('admin can create a user and an audit log is written', async () => {
    mockUser.findByPk.mockResolvedValue(admin);
    Role.findByPk.mockResolvedValue({ id: 2, name: 'Doctor' });
    mockUser.create.mockResolvedValue({
      id: 10, email: 'new@example.com', firstName: 'New', lastName: 'Doctor', phone: null, status: 'Active',
    });
    const token = tokenService.signAccessToken(admin);
    const response = await request(app).post('/api/v1/auth/users').set('Authorization', `Bearer ${token}`).send({
      email: 'new@example.com', password: 'Password123!', firstName: 'New', lastName: 'Doctor', roleId: 2,
    });
    expect(response.status).toBe(201);
    expect(AuditLog.create).toHaveBeenCalled();
    expect(mockTransaction.commit).toHaveBeenCalled();
  });
});
