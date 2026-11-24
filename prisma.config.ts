import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * `prisma generate` (run on every `npm install`, e.g. on Vercel) needs no
 * database, so the URL must be optional here. Only `migrate`/`db` commands use it.
 * Migrations should use Neon's DIRECT (non-pooled) connection string.
 */
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...(url ? { datasource: { url } } : {}),
});
