const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const mockPrisma = {
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
    },
    profile: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
};

mockPrisma.conversation = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

mockPrisma.message = {
    create: jest.fn(),
    findMany: jest.fn(),
};

mockPrisma.csrfToken = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
};

jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn(() => mockPrisma),
}));

const { app, validateProfileUpdate, countOverlap } = require('../index');

beforeEach(() => {
    jest.clearAllMocks();
});

const signTestToken = (sub) =>
    jwt.sign(
        {
            sub,
            email: 'test@example.com',
            name: 'Test User',
        },
        process.env.JWT_SECRET || 'change-me-in-env',
        { expiresIn: '1h' },
    );

describe('API basic behavior', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GET /api/health returns ok status', async () => {
        const response = await request(app).get('/api/health');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            status: 'ok',
            service: 'skyllswap-api',
        });
    });

    test('GET /api/auth/me without token returns 401', async () => {
        const response = await request(app).get('/api/auth/me');

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Unauthorized');
    });

    test('GET /api/profile/me without token returns 401', async () => {
        const response = await request(app).get('/api/profile/me');

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Unauthorized');
    });

    test('POST /api/auth/register rejects weak password', async () => {
        const payload = {
            name: 'Alice',
            email: 'alice@example.com',
            password: '123',
        };

        const response = await request(app).post('/api/auth/register').send(payload);

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('at least 8 chars');
    });

    test('GET /api/matches/me without token returns 401', async () => {
        const response = await request(app).get('/api/matches/me');

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Unauthorized');
    });

    test('GET /api/auth/me with invalid token returns 401', async () => {
        const response = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer not-a-real-token');

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('Invalid or expired token');
    });
});

describe('API business flows with Prisma mocks', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('POST /api/auth/register creates a user and normalizes email', async () => {
        mockPrisma.user.findUnique.mockResolvedValueOnce(null);
        mockPrisma.user.create.mockResolvedValueOnce({
            id: 10,
            name: 'Alice',
            email: 'alice@example.com',
            passwordHash: 'hashed',
            profile: {
                city: 'Paris',
                availability: 'flexible',
                offers: [],
                needs: [],
            },
        });

        const response = await request(app).post('/api/auth/register').send({
            name: 'Alice',
            email: ' ALICE@EXAMPLE.COM ',
            password: 'password123',
        });

        expect(response.status).toBe(201);
        expect(response.body.user).toMatchObject({
            id: 10,
            name: 'Alice',
        });
        expect(response.headers['set-cookie']).toEqual(
            expect.arrayContaining([expect.stringContaining('skyllswap_session=')]),
        );
        expect(mockPrisma.user.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    email: 'alice@example.com',
                }),
            }),
        );
    });

    test('POST /api/auth/register returns 409 when email is already used', async () => {
        mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 99, email: 'used@example.com' });

        const response = await request(app).post('/api/auth/register').send({
            name: 'Bob',
            email: 'used@example.com',
            password: 'password123',
        });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe('unable to create account');
        expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    test('POST /api/auth/login returns 401 for unknown email', async () => {
        mockPrisma.user.findUnique.mockResolvedValueOnce(null);

        const response = await request(app).post('/api/auth/login').send({
            email: 'nobody@example.com',
            password: 'password123',
        });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('invalid credentials');
    });

    test('POST /api/auth/login returns 401 for wrong password', async () => {
        const passwordHash = await bcrypt.hash('good-password', 4);
        mockPrisma.user.findUnique.mockResolvedValueOnce({
            id: 11,
            name: 'Clara',
            email: 'clara@example.com',
            passwordHash,
            profile: {
                city: 'Paris',
                availability: 'soir',
                offers: ['React'],
                needs: ['Design'],
            },
        });

        const response = await request(app).post('/api/auth/login').send({
            email: 'clara@example.com',
            password: 'bad-password',
        });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe('invalid credentials');
    });

    test('POST /api/auth/login sets a session cookie on success', async () => {
        const passwordHash = await bcrypt.hash('good-password', 4);
        mockPrisma.user.findUnique.mockResolvedValueOnce({
            id: 12,
            name: 'Lea',
            email: 'lea@example.com',
            passwordHash,
            profile: {
                city: 'Paris',
                availability: 'soir',
                offers: ['React'],
                needs: ['Node.js'],
            },
        });

        const response = await request(app).post('/api/auth/login').send({
            email: 'lea@example.com',
            password: 'good-password',
        });

        expect(response.status).toBe(200);
        expect(response.body.user).toMatchObject({
            id: 12,
            name: 'Lea',
        });
        expect(response.headers['set-cookie']).toEqual(
            expect.arrayContaining([expect.stringContaining('skyllswap_session=')]),
        );
    });

    test('GET /api/auth/me returns public user for valid token', async () => {
        const token = signTestToken(42);
        mockPrisma.user.findUnique.mockResolvedValueOnce({
            id: 42,
            name: 'Diane',
            email: 'diane@example.com',
            profile: {
                city: 'Lyon',
                availability: 'week-end',
                offers: ['React'],
                needs: ['Node.js'],
            },
        });

        const response = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`)
            .set('x-csrf-token', 'test-csrf-token');

        expect(response.status).toBe(200);
        expect(response.body.user).toMatchObject({
            id: 42,
            name: 'Diane',
            profile: expect.objectContaining({ city: 'Lyon' }),
        });
    });

    test('GET /api/auth/me accepts a session cookie', async () => {
        const token = signTestToken(43);
        mockPrisma.user.findUnique.mockResolvedValueOnce({
            id: 43,
            name: 'Eva',
            email: 'eva@example.com',
            profile: {
                city: 'Bordeaux',
                availability: 'flexible',
                offers: ['Design'],
                needs: ['React'],
            },
        });

        const response = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`)
            .set('x-csrf-token', 'test-csrf-token');

        expect(response.status).toBe(200);
        expect(response.body.user).toMatchObject({
            id: 43,
            name: 'Eva',
        });
    });

    test('PUT /api/profile/me rejects invalid payload before DB update', async () => {
        const token = signTestToken(21);

        const response = await request(app)
            .put('/api/profile/me')
            .set('Authorization', `Bearer ${token}`)
            .set('x-csrf-token', 'test-csrf-token')
            .send({ availability: 'nuit' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('availability must be one of');
        expect(mockPrisma.profile.update).not.toHaveBeenCalled();
    });

    test('GET /api/matches/me returns empty match when no candidates', async () => {
        const token = signTestToken(5);
        mockPrisma.user.findUnique.mockResolvedValueOnce({
            id: 5,
            name: 'Emma',
            profile: {
                city: 'Paris',
                availability: 'flexible',
                offers: ['React'],
                needs: ['Design UI'],
            },
        });
        mockPrisma.user.findMany.mockResolvedValueOnce([]);

        const response = await request(app)
            .get('/api/matches/me')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.bestMatch).toBeNull();
        expect(response.body.message).toContain('Aucun autre profil');
    });

    test('GET /api/matches/me returns top candidate with computed compatibility', async () => {
        const token = signTestToken(7);
        mockPrisma.user.findUnique.mockResolvedValueOnce({
            id: 7,
            name: 'Farid',
            profile: {
                city: 'Nantes',
                availability: 'soir',
                offers: ['React'],
                needs: ['Design UI'],
            },
        });
        mockPrisma.user.findMany.mockResolvedValueOnce([
            {
                id: 8,
                name: 'Gael',
                profile: {
                    city: 'Nantes',
                    offers: ['Design UI'],
                    needs: ['React'],
                },
            },
            {
                id: 9,
                name: 'Hugo',
                profile: {
                    city: 'Rennes',
                    offers: ['Cuisine'],
                    needs: ['Photo'],
                },
            },
        ]);

        const response = await request(app)
            .get('/api/matches/me')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.comparedProfiles).toBe(2);
        expect(response.body.bestMatch).toMatchObject({
            pseudo: 'Gael',
            city: 'Nantes',
            compatibility: 100,
        });
    });
});

describe('Pure helpers', () => {
    test('validateProfileUpdate accepts valid data', () => {
        const result = validateProfileUpdate({
            city: 'Lyon',
            availability: 'soir',
            offers: ['React', 'Node.js'],
            needs: ['Design UI'],
        });

        expect(result.error).toBeUndefined();
        expect(result.next).toEqual({
            city: 'Lyon',
            availability: 'soir',
            offers: ['React', 'Node.js'],
            needs: ['Design UI'],
        });
    });

    test('validateProfileUpdate rejects invalid availability', () => {
        const result = validateProfileUpdate({ availability: 'nuit' });

        expect(result.error).toContain('availability must be one of');
    });

    test('countOverlap is case-insensitive and unique-based', () => {
        const total = countOverlap(['React', 'react', 'Node'], ['REACT', 'Vue']);

        expect(total).toBe(1);
    });
});

describe('API messaging flows', () => {
    test('POST /api/conversations returns 401 without token', async () => {
        const response = await request(app)
            .post('/api/conversations')
            .send({ recipientId: 2 });

        expect(response.status).toBe(401);
    });

    test('POST /api/conversations returns 400 when no recipientId', async () => {
        const token = signTestToken(1);
        const response = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${token}`)
            .set('x-csrf-token', 'test-csrf-token')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('recipientId is required');
    });

    test('POST /api/conversations returns 400 when conversing with self', async () => {
        const token = signTestToken(1);
        const response = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${token}`)
            .set('x-csrf-token', 'test-csrf-token')
            .send({ recipientId: 1 });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('yourself');
    });

    test('GET /api/conversations returns list for authenticated user', async () => {
        const token = signTestToken(1);
        mockPrisma.conversation.findMany.mockResolvedValueOnce([
            {
                id: 10,
                participants: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
                messages: [{ id: 1, content: 'Salut !', sender: { id: 2, name: 'Bob' } }],
            },
        ]);

        const response = await request(app)
            .get('/api/conversations')
            .set('Authorization', `Bearer ${token}`)
            .set('x-csrf-token', 'test-csrf-token');

        expect(response.status).toBe(200);
        expect(response.body.conversations).toHaveLength(1);
        expect(response.body.conversations[0].id).toBe(10);
    });

    test('POST /api/conversations/:id/messages returns 400 for empty content', async () => {
        const token = signTestToken(1);
        const response = await request(app)
            .post('/api/conversations/10/messages')
            .set('Authorization', `Bearer ${token}`)
            .set('x-csrf-token', 'test-csrf-token')
            .send({ content: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('content is required');
    });

    test('POST /api/conversations/:id/messages sends message successfully', async () => {
        const token = signTestToken(1);
        mockPrisma.conversation.findFirst.mockResolvedValueOnce({ id: 10 });
        mockPrisma.message.create.mockResolvedValueOnce({
            id: 55,
            content: 'Hello !',
            senderId: 1,
            conversationId: 10,
            sender: { id: 1, name: 'Alice' },
            createdAt: new Date().toISOString(),
        });
        mockPrisma.conversation.update.mockResolvedValueOnce({ id: 10 });

        const response = await request(app)
            .post('/api/conversations/10/messages')
            .set('Authorization', `Bearer ${token}`)
            .set('x-csrf-token', 'test-csrf-token')
            .send({ content: 'Hello !' });

        expect(response.status).toBe(201);
        expect(response.body.message).toMatchObject({ id: 55, content: 'Hello !' });
    });

    test('GET /api/conversations/:id/messages returns 404 for unknown conversation', async () => {
        const token = signTestToken(1);
        mockPrisma.conversation.findFirst.mockResolvedValueOnce(null);

        const response = await request(app)
            .get('/api/conversations/999/messages')
            .set('Authorization', `Bearer ${token}`)
            .set('x-csrf-token', 'test-csrf-token');

        expect(response.status).toBe(404);
    });
});
