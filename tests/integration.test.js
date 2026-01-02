
const request = require('supertest');
const { Pool } = require('pg');

// Mock variable must start with "mock"
const mockPool = {
    query: jest.fn(),
    on: jest.fn(),
    connect: jest.fn(),
};

jest.mock('pg', () => {
    return { Pool: jest.fn(() => mockPool) };
});

let app;

describe('Server API Integration', () => {

    beforeAll(() => {
        process.env.ADMIN_PASSWORD = 'test_password';
        process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
        jest.isolateModules(() => {
            app = require('../server');
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('GET /api/files/:id/details returns file details', async () => {
        const mockFile = { id: 1, standard_id: 1, title: 'Test File', description: 'Desc', filename: 'f.pdf', original_name: 'o.pdf' };
        mockPool.query.mockResolvedValueOnce({ rows: [mockFile] });

        const res = await request(app).get('/api/files/1/details');

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual(mockFile);
        expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['1']);
    });

    test('PUT /api/files/:id updates file', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Update result

        const res = await request(app)
            .put('/api/files/1')
            .set('X-Admin-Token', 'test_password')
            .send({ standardId: 2, title: 'New Title', description: 'New Desc' });

        expect(res.statusCode).toEqual(200);
        expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE files'),
            [2, 'New Title', 'New Desc', '1']
        );
    });

    test('PUT /api/files/:id requires admin', async () => {
        const res = await request(app)
            .put('/api/files/1')
            .send({ standardId: 2, title: 'New Title' });

        expect(res.statusCode).toEqual(401);
    });
});
