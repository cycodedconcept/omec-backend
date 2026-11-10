const mockTransaction = { LOCK: { UPDATE: 'UPDATE' } };
const mockModels = {
  User: { unscoped: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
  Role: { findOne: jest.fn() },
  Staff: {},
  Notification: { create: jest.fn(), findAndCountAll: jest.fn(), count: jest.fn(), findOne: jest.fn() },
  AuditLog: { create: jest.fn() },
  sequelize: { transaction: jest.fn(async (callback) => callback(mockTransaction)) },
};
mockModels.User.unscoped.mockReturnValue(mockModels.User);

jest.mock('../src/models', () => mockModels);

const request = require('supertest');
const app = require('../src/app');
const tokenService = require('../src/services/token.service');
const notificationService = require('../src/services/notification.service');
const examples = require('./fixtures/notification-examples.json');

const doctor = { id: 2, status: 'Active', role: { id: 2, name: 'Doctor' }, staffProfile: { id: 5, status: 'Active' } };
const token = () => `Bearer ${tokenService.signAccessToken(doctor)}`;

describe('notification routes', () => {
  test.each(examples)('matches published Postman response: $name', async (example) => {
    const expected = example.responses[0].body;
    const item = expected.data.items ? expected.data.items[0] : expected.data;
    const user = { ...doctor, id: item.userId, role: { name: /admin/i.test(example.name) ? 'Admin' : 'Doctor' } };
    mockModels.User.findByPk.mockResolvedValue(user);
    if (example.method === 'GET') {
      mockModels.Notification.findAndCountAll.mockResolvedValue({ count: 1, rows: [item] });
      mockModels.Notification.count.mockResolvedValue(expected.data.unreadCount);
    } else {
      mockModels.Notification.findOne.mockResolvedValue(item);
    }
    const url = example.method === 'GET'
      ? `/api/v1/notifications?page=1&limit=${expected.data.pagination.limit}`
      : `/api/v1/notifications/${item.id}/read`;
    const response = await request(app)[example.method.toLowerCase()](url)
      .set('Authorization', `Bearer ${tokenService.signAccessToken(user)}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expected);
  });

  test.each(['get', 'patch'])('rejects unauthenticated %s requests', async (method) => {
    const path = method === 'get' ? '' : '/10/read';
    const response = await request(app)[method](`/api/v1/notifications${path}`);
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test.each(['page=0', 'limit=101', 'isRead=invalid', 'type='])('rejects invalid filters: %s', async (query) => {
    const response = await request(app).get(`/api/v1/notifications?${query}`).set('Authorization', token());
    expect(response.status).toBe(422);
    expect(mockModels.Notification.findAndCountAll).not.toHaveBeenCalled();
  });

  test('repeat read keeps the original read timestamp and does not update the row', async () => {
    const item = { id: 10, userId: 2, isRead: true, readAt: '2026-10-20T12:57:12.043Z', update: jest.fn() };
    mockModels.Notification.findOne.mockResolvedValue(item);
    const response = await request(app).patch('/api/v1/notifications/10/read').set('Authorization', token());
    expect(response.status).toBe(200);
    expect(response.body.data.readAt).toBe(item.readAt);
    expect(item.update).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockModels.AuditLog.create.mockResolvedValue({ id: 1 });
    mockModels.User.unscoped.mockReturnValue(mockModels.User);
    mockModels.User.findByPk.mockResolvedValue(doctor);
    mockModels.Role.findOne.mockResolvedValue({ id: 1 });
    mockModels.User.findAll.mockResolvedValue([{ id: 1 }, { id: 3 }]);
    mockModels.Notification.create.mockImplementation(async (values) => ({ id: 100 + values.userId, ...values }));
    mockModels.sequelize.transaction.mockImplementation(async (callback) => callback(mockTransaction));
    tokenService.clearRevocations();
  });

  test('lists only the current user notifications with unread count', async () => {
    mockModels.Notification.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{ id: 10, userId: 2, title: 'New appointment', isRead: false }],
    });
    mockModels.Notification.count.mockResolvedValue(1);
    const response = await request(app).get('/api/v1/notifications?page=1&limit=10')
      .set('Authorization', token());
    expect(response.status).toBe(200);
    expect(response.body.data.unreadCount).toBe(1);
    expect(response.body.data.pagination).toEqual({ page: 1, limit: 10, total: 1, pages: 1 });
    expect(mockModels.Notification.findAndCountAll.mock.calls[0][0].where.userId).toBe(2);
  });

  test('filters the current user notification inbox by unread state and event type', async () => {
    mockModels.Notification.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    mockModels.Notification.count.mockResolvedValue(0);
    const response = await request(app).get('/api/v1/notifications?isRead=false&type=PATIENT_REGISTERED')
      .set('Authorization', token());
    expect(response.status).toBe(200);
    expect(mockModels.Notification.findAndCountAll.mock.calls[0][0].where).toMatchObject({
      userId: 2, isRead: false, type: 'PATIENT_REGISTERED',
    });
  });

  test('creates admin notifications for active admin recipients while excluding duplicate recipients', async () => {
    const notifications = await notificationService.createAdminNotifications({
      type: 'APPOINTMENT_STATUS_CHANGED', title: 'Appointment status updated', message: 'Updated',
      relatedType: 'appointment', relatedId: 4, excludeUserIds: [1],
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe(3);
    expect(mockModels.Notification.create).toHaveBeenCalledTimes(1);
  });

  test('marks an owned notification read and writes an audit row', async () => {
    const notification = {
      id: 10, userId: 2, isRead: false, readAt: null,
      update: jest.fn(async (values) => Object.assign(notification, values)),
    };
    mockModels.Notification.findOne.mockResolvedValue(notification);
    const response = await request(app).patch('/api/v1/notifications/10/read')
      .set('Authorization', token());
    expect(response.status).toBe(200);
    expect(response.body.data.isRead).toBe(true);
    expect(response.body.data.readAt).toBeTruthy();
    expect(mockModels.AuditLog.create).toHaveBeenCalled();
  });

  test('cannot mark another user notification read', async () => {
    mockModels.Notification.findOne.mockResolvedValue(null);
    const response = await request(app).patch('/api/v1/notifications/99/read')
      .set('Authorization', token());
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Notification not found');
  });
});
