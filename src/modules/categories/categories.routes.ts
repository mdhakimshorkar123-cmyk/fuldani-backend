import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { cached, invalidate, TTL } from '../../lib/cache';
import { HttpError, parse } from '../../lib/http';
import { slugify } from '../../lib/utils';
import { requireAdmin } from '../../middleware/auth';

const shape = {
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).nullish(),
  description: z.string().trim().max(500).nullable(),
  image: z.string().trim().max(500).nullable(),
  sortOrder: z.coerce.number().int(),
  isActive: z.boolean(),
};
const CategoryInput = z.object({
  ...shape,
  description: shape.description.optional().default(null),
  image: shape.image.optional().default(null),
  sortOrder: shape.sortOrder.default(0),
  isActive: shape.isActive.default(true),
});
const CategoryPatch = z.object(shape).partial();

// ── Public: /api/categories ───────────────────────────────────
export const categoriesRouter = Router();

categoriesRouter.get('/', async (_req, res) => {
  const items = await cached('categories', 'public', TTL.long, () =>
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        image: true,
        _count: { select: { products: { where: { isActive: true } } } },
      },
    }),
  );
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({ items });
});

// ── Admin: /api/admin/categories ──────────────────────────────
export const adminCategoriesRouter = Router();
adminCategoriesRouter.use(requireAdmin());

adminCategoriesRouter.get('/', async (_req, res) => {
  const items = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: true } } },
  });
  res.json({ items });
});

adminCategoriesRouter.post('/', async (req, res) => {
  const { slug, ...data } = parse(CategoryInput, req.body);
  const finalSlug = slugify(slug || data.name);
  if (!finalSlug) throw HttpError.badRequest('Validation failed', { slug: 'Slug is required' });
  const category = await prisma.category.create({ data: { ...data, slug: finalSlug } });
  await invalidate('categories', 'products');
  res.status(201).json({ category });
});

adminCategoriesRouter.patch('/:id', async (req, res) => {
  const { slug, ...data } = parse(CategoryPatch, req.body);
  const category = await prisma.category.update({
    where: { id: req.params.id },
    data: { ...data, ...(slug ? { slug: slugify(slug) } : {}) },
  });
  await invalidate('categories', 'products');
  res.json({ category });
});

adminCategoriesRouter.delete('/:id', requireAdmin('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  await prisma.category.delete({ where: { id: String(req.params.id) } });
  await invalidate('categories', 'products');
  res.status(204).end();
});
