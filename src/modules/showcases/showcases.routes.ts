import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { cached, invalidate, TTL } from '../../lib/cache';
import { parse } from '../../lib/http';
import { requireAdmin } from '../../middleware/auth';

const shape = {
  title: z.string().trim().min(2).max(80),
  tag: z.string().trim().min(1).max(60),
  image: z.string().trim().min(1).max(500),
  sortOrder: z.coerce.number().int(),
  isActive: z.boolean(),
};
const ShowcaseInput = z.object({ ...shape, sortOrder: shape.sortOrder.default(0), isActive: shape.isActive.default(true) });
const ShowcasePatch = z.object(shape).partial();

// ── Public: /api/showcases ────────────────────────────────────
export const showcasesRouter = Router();

showcasesRouter.get('/', async (_req, res) => {
  const items = await cached('showcases', 'public', TTL.long, () =>
    prisma.showcase.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, tag: true, image: true },
    }),
  );
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({ items });
});

// ── Admin: /api/admin/showcases ───────────────────────────────
export const adminShowcasesRouter = Router();
adminShowcasesRouter.use(requireAdmin());

adminShowcasesRouter.get('/', async (_req, res) => {
  res.json({ items: await prisma.showcase.findMany({ orderBy: { sortOrder: 'asc' } }) });
});

adminShowcasesRouter.post('/', async (req, res) => {
  const showcase = await prisma.showcase.create({ data: parse(ShowcaseInput, req.body) });
  await invalidate('showcases');
  res.status(201).json({ showcase });
});

adminShowcasesRouter.patch('/:id', async (req, res) => {
  const showcase = await prisma.showcase.update({ where: { id: req.params.id }, data: parse(ShowcasePatch, req.body) });
  await invalidate('showcases');
  res.json({ showcase });
});

adminShowcasesRouter.delete('/:id', async (req, res) => {
  await prisma.showcase.delete({ where: { id: req.params.id } });
  await invalidate('showcases');
  res.status(204).end();
});
