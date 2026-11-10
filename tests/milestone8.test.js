const express = require('express');
const request = require('supertest');

const mockAuditCreate = jest.fn().mockResolvedValue({});
jest.mock('../src/models', () => ({ AuditLog: { create: mockAuditCreate } }));

const auditLogger = require('../src/middleware/auditLogger');
const auditService = require('../src/services/audit.service');
const errorHandler = require('../src/middleware/errorHandler');
const enforceHttps = require('../src/middleware/https');
const authRateLimiter = require('../src/middleware/authRateLimiter');
const env = require('../src/config/env');

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('Milestone 8 middleware', () => {
  beforeEach(() => mockAuditCreate.mockClear());

  test('fallback middleware audits a successful mutation with the authenticated user', async () => {
    const app = express();
    app.use(express.json(), auditLogger);
    app.post('/api/v1/patients', (req, res) => {
      req.user = { id: 7 };
      res.status(201).json({ success: true, data: { id: 42, firstName: 'Ada' }, error: null });
    });

    await request(app).post('/api/v1/patients').send({ firstName: 'Ada' }).expect(201);
    await tick();

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7, action: 'CREATE', tableName: 'patients', recordId: '42',
    }), { transaction: undefined });
  });

  test('transaction-safe controller audit prevents a duplicate fallback row', async () => {
    const app = express();
    app.use(express.json(), auditLogger);
    app.patch('/api/v1/patients/4/status', async (req, res) => {
      req.user = { id: 2 };
      await auditService.writeAudit({ userId: 2, action: 'UPDATE_STATUS', tableName: 'patients', recordId: 4 });
      res.json({ success: true, data: { id: 4, status: 'Admitted' }, error: null });
    });

    await request(app).patch('/api/v1/patients/4/status').send({ status: 'Admitted' }).expect(200);
    await tick();
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
  });

  test('failed mutations do not produce audit rows', async () => {
    const app = express();
    app.use(express.json(), auditLogger);
    app.post('/api/v1/staff', (req, res) => res.status(422).json({ success: false, data: null, error: 'Invalid' }));

    await request(app).post('/api/v1/staff').send({}).expect(422);
    await tick();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  test('global error handler preserves the standard shape and maps unique conflicts', async () => {
    const app = express();
    app.get('/failure', (req, res, next) => next(Object.assign(new Error('Duplicate'), {
      name: 'SequelizeUniqueConstraintError',
    })));
    app.use(errorHandler);

    const response = await request(app).get('/failure').expect(409);
    expect(response.body).toEqual({ success: false, data: null, error: 'Duplicate' });
  });

  test('HTTPS is enforced only when production enforcement is enabled', async () => {
    const originalNodeEnv = env.nodeEnv;
    const originalEnforceHttps = env.enforceHttps;
    env.nodeEnv = 'production';
    env.enforceHttps = true;

    const app = express();
    app.use(enforceHttps);
    app.get('/secure', (req, res) => res.json({ success: true }));

    const response = await request(app).get('/secure').expect(426);
    expect(response.body).toEqual({ success: false, data: null, error: 'HTTPS is required' });

    env.nodeEnv = originalNodeEnv;
    env.enforceHttps = originalEnforceHttps;
  });

  test('authentication limiter returns the standard 429 response and rate headers', async () => {
    const app = express();
    app.use('/api/v1/auth', authRateLimiter);
    app.post('/api/v1/auth/login', (req, res) => res.json({ success: true, data: {}, error: null }));

    let response;
    for (let attempt = 0; attempt <= env.authRateLimit.max; attempt += 1) {
      response = await request(app).post('/api/v1/auth/login');
    }

    expect(response.status).toBe(429);
    expect(response.headers).toHaveProperty('ratelimit');
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: 'Too many authentication requests. Please try again later.',
    });
  });
});
