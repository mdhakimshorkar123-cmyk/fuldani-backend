import { Router } from 'express';
import { HttpError, parse } from '../../lib/http';
import { requireAdmin } from '../../middleware/auth';
import { AdminProductListQuery, ProductInput, ProductListQuery, ProductPatch } from './products.schema';
import * as service from './products.service';

// ── Public: /api/products ─────────────────────────────────────
export const productsRouter = Router();

productsRouter.get('/', async (req, res) => {
  const query = parse(ProductListQuery, req.query);
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  res.json(await service.listPublicProducts(query));
});

productsRouter.get('/featured', async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  res.json({ product: await service.getFeaturedProduct() });
});

productsRouter.get('/:slug', async (req, res) => {
  const data = await service.getPublicProductBySlug(req.params.slug);
  if (!data) throw HttpError.notFound('Product not found');
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  res.json(data);
});

// ── Admin: /api/admin/products ────────────────────────────────
export const adminProductsRouter = Router();
adminProductsRouter.use(requireAdmin());

adminProductsRouter.get('/', async (req, res) => {
  res.json(await service.listAdminProducts(parse(AdminProductListQuery, req.query)));
});

adminProductsRouter.get('/:id', async (req, res) => {
  res.json({ product: await service.getAdminProduct(req.params.id) });
});

adminProductsRouter.post('/', async (req, res) => {
  res.status(201).json({ product: await service.createProduct(parse(ProductInput, req.body)) });
});

adminProductsRouter.patch('/:id', async (req, res) => {
  res.json({ product: await service.updateProduct(req.params.id, parse(ProductPatch, req.body)) });
});

adminProductsRouter.delete('/:id', requireAdmin('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  await service.deleteProduct(String(req.params.id));
  res.status(204).end();
});
