const mockModels = {
  User: { unscoped: jest.fn(), findByPk: jest.fn() },
  Role: {},
  Staff: { count: jest.fn() },
  Patient: { count: jest.fn() },
  Appointment: { count: jest.fn(), findAndCountAll: jest.fn() },
  Department: {},
  sequelize: { query: jest.fn() },
};
mockModels.User.unscoped.mockReturnValue(mockModels.User);

jest.mock('../src/models', () => mockModels);

const request = require('supertest');
const app = require('../src/app');
const tokenService = require('../src/services/token.service');

const admin = { id: 1, status: 'Active', role: { id: 1, name: 'Admin' } };
const token = () => `Bearer ${tokenService.signAccessToken(admin)}`;

describe('dashboard routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModels.User.unscoped.mockReturnValue(mockModels.User);
    mockModels.User.findByPk.mockResolvedValue(admin);
    tokenService.clearRevocations();
  });

  test('returns KPI values and prior-period percentage changes', async () => {
    mockModels.Patient.count
      .mockResolvedValueOnce(100).mockResolvedValueOnce(20).mockResolvedValueOnce(10);
    mockModels.Staff.count
      .mockResolvedValueOnce(40).mockResolvedValueOnce(4).mockResolvedValueOnce(5);
    mockModels.Appointment.count
      .mockResolvedValueOnce(12).mockResolvedValueOnce(8);
    const response = await request(app).get('/api/v1/dashboard/stats').set('Authorization', token());
    expect(response.status).toBe(200);
    expect(response.body.data.totalPatients).toEqual({ value: 100, percentChange: 100 });
    expect(response.body.data.totalStaff).toEqual({ value: 40, percentChange: -20 });
    expect(response.body.data.appointmentsToday).toEqual({ value: 12, percentChange: 50 });
    expect(response.body.data.revenueToday).toMatchObject({ value: 0, placeholder: true });
  });

  test('returns twelve chart months with lab and revenue placeholders', async () => {
    mockModels.sequelize.query.mockResolvedValue([{ month: '2026-08', patient_count: 7 }]);
    const response = await request(app).get('/api/v1/dashboard/chart').set('Authorization', token());
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(12);
    expect(response.body.data.items.every((item) => item.labTestCount === 0 && item.revenue === 0)).toBe(true);
    expect(response.body.data.items.find((item) => item.month === '2026-08')?.patientInflow).toBe(7);
  });

  test('returns paginated appointments for today', async () => {
    mockModels.Appointment.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{ id: 9, appointmentTime: '10:00:00', status: 'Confirmed' }],
    });
    const response = await request(app).get('/api/v1/dashboard/today-appointments?page=1&limit=10&status=Confirmed')
      .set('Authorization', token());
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.pagination).toEqual({ page: 1, limit: 10, total: 1, pages: 1 });
  });

  test('dashboard endpoints require authentication', async () => {
    const response = await request(app).get('/api/v1/dashboard/stats');
    expect(response.status).toBe(401);
  });
});
