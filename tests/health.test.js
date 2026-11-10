const request = require('supertest');
const app = require('../src/app');

describe('GET /api/v1/health', () => {
  it('returns the standard healthy response', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ok' }, error: null });
  });
});
