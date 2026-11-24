# fuldani-backend

REST API for **স্বপ্ন ফুলদানি (Shopno Fuldani)** — Node.js · Express 5 · TypeScript · Prisma 7 · Neon Postgres · Redis.

## Setup
```bash
cp .env.example .env     # fill DATABASE_URL, DIRECT_URL (Neon), REDIS_URL, JWT_SECRET
npm install
npm run db:deploy        # apply migrations
npm run db:seed          # demo data + first admin
npm run dev              # http://localhost:4000
```

## Scripts
| Script | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` / `npm start` | Production build & run |
| `npm run db:migrate` | Create a new migration (dev) |
| `npm run db:deploy` | Apply migrations (prod) |
| `npm run db:seed` | Seed data |
| `npm run db:studio` | Prisma Studio |

Health check: `GET /health`
