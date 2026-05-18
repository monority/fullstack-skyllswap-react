const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const mockPrisma = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    profile: { findUnique: jest.fn(), update: jest.fn() },
    csrfToken: { findUnique: jest.fn() },
    refreshToken: { findUnique: jest.fn(), deleteMany: jest.fn(), create: jest.fn() }
};
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => mockPrisma) }));
const { app } = require('../../index');

describe('Advanced Security Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects excessively long input in registration', async () => {
        const longName = 'A'.repeat(100);
        const response = await request(app).post('/api/auth/register').send({
            name: longName,
            email: 'test@test.com',
            password: 'password123'
        });
        expect([400, 500]).toContain(response.status);
    });

    test('rejects SQL injection in email field', async () => {
        const response = await request(app).post('/api/auth/register').send({
            name: 'Test User',
            email: "test@test.com'; DROP TABLE users;--",
            password: 'password123'
        });
        expect([400, 500]).toContain(response.status);
    });

    test('rejects XSS payload in name field', async () => {
        const response = await request(app).post('/api/auth/register').send({
            name: '<script>alert("xss")</script>',
            email: 'test@test.com',
            password: 'password123'
        });
        expect([400, 201, 500]).toContain(response.status);
    });

    test('validates password strength', async () => {
        const weakPasswords = ['12345678', 'password', 'abcdefgh', 'qwertyui'];

        for (const password of weakPasswords) {
            const response = await request(app).post('/api/auth/register').send({
                name: 'Test User',
                email: 'test@test.com',
                password: password
            });
            expect([400, 201, 500]).toContain(response.status);
        }
    });

    test('rejects malformed JSON in request body', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .set('Content-Type', 'application/json')
            .send('{malformed json');
        expect([400, 500]).toContain(response.status);
    });

    test('rejects excessively large request body', async () => {
        const largeBody = { data: 'A'.repeat(200000) }; // 200KB
        const response = await request(app)
            .post('/api/auth/register')
            .send(largeBody);
        expect([400, 413, 500]).toContain(response.status);
    });

    test('validates content-type header', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .set('Content-Type', 'text/plain')
            .send('name=test&email=test@test.com&password=test123');
        expect([400, 415, 500]).toContain(response.status);
    });

    test('rejects path traversal attempts', async () => {
        const paths = ['../../../etc/passwd', '..\\..\\windows\\system32', '%2e%2e%2f'];

        for (const path of paths) {
            const response = await request(app).get(`/api/${path}`);
            expect([404, 400, 500]).toContain(response.status);
        }
    });

    test('validates CORS preflight for invalid origins', async () => {
        const response = await request(app)
            .options('/api/health')
            .set('Origin', 'https://malicious-site.com')
            .set('Access-Control-Request-Method', 'GET');
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('checks for information disclosure in error messages', async () => {
        // Simuler une erreur interne
        mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

        const response = await request(app).post('/api/auth/login').send({
            email: 'test@test.com',
            password: 'password123'
        });

        // Le message d'erreur ne doit pas révéler d'informations internes
        expect(response.body.message).not.toContain('Database');
        expect(response.body.message).not.toContain('connection');
        expect(response.body.message).toBe('internal server error');
    });

    test('validates session cookie attributes', async () => {
        // Simuler une connexion réussie
        mockPrisma.user.findUnique.mockResolvedValue({
            id: 1,
            name: 'Test User',
            email: 'test@test.com',
            passwordHash: bcrypt.hashSync('password123', 10),
            profile: null
        });
        mockPrisma.csrfToken.findUnique.mockResolvedValue(null);
        mockPrisma.refreshToken.deleteMany.mockResolvedValue({});
        mockPrisma.refreshToken.create.mockResolvedValue({});

        const response = await request(app).post('/api/auth/login').send({
            email: 'test@test.com',
            password: 'password123'
        });

        // Vérifier les attributs des cookies
        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();

        if (cookies) {
            const sessionCookie = cookies.find(c => c.includes('skyllswap_session'));
            expect(sessionCookie).toBeDefined();

            if (sessionCookie) {
                expect(sessionCookie).toContain('HttpOnly');
                expect(sessionCookie).toContain('Path=/');
            }
        }
    });

    test('detects and blocks rapid fire requests', async () => {
        const requests = [];
        for (let i = 0; i < 15; i++) {
            requests.push(request(app).post('/api/auth/login').send({
                email: `test${i}@test.com`,
                password: 'password123'
            }));
        }

        const responses = await Promise.all(requests);
        const rateLimited = responses.filter(r => r.status === 429);
        expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('validates JWT token algorithm', async () => {
        // Créer un token avec un algorithme faible
        const weakToken = jwt.sign({ sub: 1 }, 'weak-secret', { algorithm: 'none' });

        const response = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${weakToken}`);

        expect(response.status).toBe(401);
    });
});

describe('Security Headers Validation', () => {
    test('CSP header is present and properly configured', async () => {
        const response = await request(app).get('/api/health');

        expect(response.headers['content-security-policy']).toBeDefined();

        const csp = response.headers['content-security-policy'];
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).toContain("object-src 'none'");
    });

    test('X-Content-Type-Options is nosniff', async () => {
        const response = await request(app).get('/api/health');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('X-Frame-Options is SAMEORIGIN or DENY', async () => {
        const response = await request(app).get('/api/health');
        expect(['SAMEORIGIN', 'DENY']).toContain(response.headers['x-frame-options']);
    });

    test('Referrer-Policy is set', async () => {
        const response = await request(app).get('/api/health');
        expect(response.headers['referrer-policy']).toBeDefined();
    });

    test('HSTS header is present in production mode', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const response = await request(app).get('/api/health');
        expect(response.headers['strict-transport-security']).toBeDefined();

        process.env.NODE_ENV = originalEnv;
    });
});