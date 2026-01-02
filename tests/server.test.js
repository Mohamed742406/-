
const request = require('supertest');
const { Pool } = require('pg');

// Mock pg
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
    on: jest.fn(),
    connect: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

// We need to delay importing server until we mocked pg
// But since server.js executes code at top level (creating Pool),
// we need to make sure the mock is in place.
// Also server.js starts listening on import, which might be an issue.
// Ideally we should export 'app' from server.js and not listen if it's imported.
// But I cannot easily modify server.js structure heavily without risk.
// I will modify server.js slightly to export app and only listen if run directly.

let app;

describe('Server API', () => {
  let pool;

  beforeAll(() => {
     // Setup environment variables
     process.env.ADMIN_PASSWORD = 'test_password';
     process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

     // Reload server to apply mocks
     jest.isolateModules(() => {
        app = require('../server');
     });

     pool = new Pool();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET / returns 200', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
  });

  test('GET /api/standards returns standards', async () => {
    const mockStandards = [
        { id: 1, code: 'ASTM', name: 'ASTM Standards', description: 'Desc' }
    ];
    pool.query.mockResolvedValueOnce({ rows: mockStandards });

    const res = await request(app).get('/api/standards');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual(mockStandards);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
  });

  test('POST /api/admin/login with correct password', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send({ password: 'test_password' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.token).toEqual('test_password');
  });

  test('POST /api/admin/login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send({ password: 'wrong' });

      expect(res.statusCode).toEqual(401);
  });
});
