const http = require('http');

const mockTransaction = { LOCK: { UPDATE: 'UPDATE' } };
const users = {
  4: { id: 4, status: 'Active', role: { id: 4, name: 'Receptionist' }, staffProfile: null },
  20: { id: 20, status: 'Active', role: { id: 2, name: 'Doctor' }, staffProfile: { id: 5, status: 'Active' } },
  21: { id: 21, status: 'Active', role: { id: 2, name: 'Doctor' }, staffProfile: { id: 6, status: 'Active' } },
};
const mockModels = {
  User: { unscoped: jest.fn(), findByPk: jest.fn(), findAll: jest.fn().mockResolvedValue([]) },
  Role: { findOne: jest.fn().mockResolvedValue(null) },
  Patient: { findByPk: jest.fn(), count: jest.fn() },
  Staff: { findByPk: jest.fn(), count: jest.fn() },
  Department: { findByPk: jest.fn() },
  Appointment: { create: jest.fn(), findByPk: jest.fn(), count: jest.fn() },
  Notification: { create: jest.fn(), findOne: jest.fn() },
  AuditLog: { create: jest.fn() },
  sequelize: { transaction: jest.fn(async (callback) => callback(mockTransaction)) },
};
mockModels.User.unscoped.mockReturnValue(mockModels.User);

jest.mock('../src/models', () => mockModels);

const request = require('supertest');
const { io: createClient } = require('socket.io-client');
const app = require('../src/app');
const tokenService = require('../src/services/token.service');
const { initializeSocket, clearSocket } = require('../src/config/socket');

const appointment = {
  id: 31, patientId: 7, doctorId: 5, departmentId: 3,
  appointmentDate: '2026-09-15', appointmentTime: '09:00:00', status: 'Pending', createdBy: 4,
  toJSON() { return { ...this, toJSON: undefined }; },
};

describe('Socket.IO appointment notifications', () => {
  let server;
  let assignedClient;
  let otherClient;

  beforeEach((done) => {
    jest.clearAllMocks();
    tokenService.clearRevocations();
    mockModels.User.unscoped.mockReturnValue(mockModels.User);
    mockModels.User.findByPk.mockImplementation(async (id) => users[Number(id)] || null);
    mockModels.Patient.findByPk.mockResolvedValue({ id: 7 });
    mockModels.Staff.findByPk.mockResolvedValue({
      id: 5, userId: 20, departmentId: 3, status: 'Active',
      user: { id: 20, status: 'Active', role: { name: 'Doctor' } },
    });
    mockModels.Department.findByPk.mockResolvedValue({ id: 3, status: 'Active' });
    mockModels.Appointment.create.mockResolvedValue(appointment);
    mockModels.Appointment.findByPk.mockResolvedValue(appointment);
    mockModels.Notification.create.mockImplementation(async (values) => ({ id: 50, ...values }));
    mockModels.Patient.count.mockResolvedValue(1);
    mockModels.Staff.count.mockResolvedValue(2);
    mockModels.Appointment.count.mockResolvedValue(1);
    mockModels.sequelize.transaction.mockImplementation(async (callback) => callback(mockTransaction));
    server = http.createServer(app);
    initializeSocket(server, { cors: { origin: '*' } });
    server.listen(0, '127.0.0.1', done);
  });

  afterEach((done) => {
    assignedClient?.disconnect();
    otherClient?.disconnect();
    clearSocket();
    server.close(done);
  });

  test('booking push reaches the assigned Doctor only', async () => {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}`;
    const assignedToken = tokenService.signAccessToken(users[20]);
    const otherToken = tokenService.signAccessToken(users[21]);
    assignedClient = createClient(url, { auth: { token: assignedToken }, transports: ['websocket'] });
    otherClient = createClient(url, { auth: { token: otherToken }, transports: ['websocket'] });

    await Promise.all([
      new Promise((resolve, reject) => {
        assignedClient.once('socket:ready', resolve);
        assignedClient.once('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        otherClient.once('socket:ready', resolve);
        otherClient.once('connect_error', reject);
      }),
    ]);

    let otherReceived = false;
    let otherNotification = false;
    otherClient.on('appointment:booked', () => { otherReceived = true; });
    otherClient.on('notification:new', () => { otherNotification = true; });
    const notificationEvent = new Promise((resolve) => assignedClient.once('notification:new', resolve));
    const assignedEvent = new Promise((resolve) => assignedClient.once('appointment:booked', resolve));
    const dashboardEvent = new Promise((resolve) => assignedClient.once('dashboard:stats_updated', resolve));
    const receptionistToken = tokenService.signAccessToken(users[4]);
    const response = await request(server).post('/api/v1/appointments')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ patientId: 7, doctorId: 5, departmentId: 3, appointmentDate: '2026-09-15', appointmentTime: '09:00' });
    expect(response.status).toBe(201);
    const event = await assignedEvent;
    const notification = await notificationEvent;
    expect(notification).toMatchObject({ userId: 20, type: 'APPOINTMENT_BOOKED', isRead: false });
    const dashboardStats = await dashboardEvent;
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(event.id).toBe(31);
    expect(dashboardStats.totalPatients.value).toBe(1);
    expect(otherReceived).toBe(false);
    expect(otherNotification).toBe(false);

    const stored = { ...notification, readAt: null, update: jest.fn(async (values) => Object.assign(stored, values)) };
    mockModels.Notification.findOne.mockResolvedValue(stored);
    let otherRead = false;
    otherClient.on('notification:read', () => { otherRead = true; });
    const readEvent = new Promise((resolve) => assignedClient.once('notification:read', resolve));
    const readResponse = await request(server).patch(`/api/v1/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${assignedToken}`);
    expect(readResponse.status).toBe(200);
    const read = await readEvent;
    expect(read).toMatchObject({ id: notification.id, userId: 20, isRead: true });
    expect(read.readAt).toBeTruthy();
    expect(mockModels.Notification.findOne.mock.calls[0][0].where).toEqual({ id: notification.id, userId: 20 });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(otherRead).toBe(false);
  });
});
