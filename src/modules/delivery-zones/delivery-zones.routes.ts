import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { cached, invalidate, TTL } from '../../lib/cache.js';
import { parse } from '../../lib/http.js';
import { requireAdmin } from '../../middleware/auth.js';

const shape = {
  name: z.string().trim().min(2).max(80),
  fee: z.coerce.number().int().min(0).max(10_000),
  sortOrder: z.coerce.number().int(),
  isActive: z.boolean(),
};
const ZoneInput = z.object({ ...shape, sortOrder: shape.sortOrder.default(0), isActive: shape.isActive.default(true) });
const ZonePatch = z.object(shape).partial();

export const getActiveZones = () =>
  cached('zones', 'active', TTL.long, () =>
    prisma.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { fee: 'asc' }],
      select: { id: true, name: true, fee: true },
    }),
  );

// ── Public: /api/delivery-zones ───────────────────────────────
export const deliveryZonesRouter = Router();

deliveryZonesRouter.get('/', async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({ items: await getActiveZones() });
});

// ── Admin: /api/admin/delivery-zones ──────────────────────────
export const adminDeliveryZonesRouter = Router();
adminDeliveryZonesRouter.use(requireAdmin());

adminDeliveryZonesRouter.get('/', async (_req, res) => {
  const items = await prisma.deliveryZone.findMany({
    orderBy: [{ sortOrder: 'asc' }, { fee: 'asc' }],
    include: { _count: { select: { orders: true } } },
  });
  res.json({ items });
});

adminDeliveryZonesRouter.post('/', async (req, res) => {
  const zone = await prisma.deliveryZone.create({ data: parse(ZoneInput, req.body) });
  await invalidate('zones');
  res.status(201).json({ zone });
});

adminDeliveryZonesRouter.patch('/:id', async (req, res) => {
  const zone = await prisma.deliveryZone.update({ where: { id: req.params.id }, data: parse(ZonePatch, req.body) });
  await invalidate('zones');
  res.json({ zone });
});

adminDeliveryZonesRouter.delete('/:id', requireAdmin('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  await prisma.deliveryZone.delete({ where: { id: String(req.params.id) } });
  await invalidate('zones');
  res.status(204).end();
});
