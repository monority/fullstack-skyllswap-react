# SkyllSwap

Plateforme simple d'echange de competences entre pairs.

## Stack

| Frontend | Backend | Database |
|----------|---------|----------|
| React + Vite + TypeScript | Express + Socket.IO | PostgreSQL + Prisma |

## Lancer le projet

```bash
# Backend
cd backend
copy .env.example .env
npm install
npm run prisma:migrate
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Tests

```bash
cd backend
npm test

cd frontend
npm test
```

## Endpoints utiles

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/skills`
- `GET /api/matches/me`

## Notes

- Frontend deploye sur Vercel
- Backend deploye sur Render
- Base de donnees sur Neon PostgreSQL
