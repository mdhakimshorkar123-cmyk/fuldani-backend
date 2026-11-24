import { Router } from 'express';
import { parse } from '../../lib/http.js';
import { requireAdmin } from '../../middleware/auth.js';
import { orderLimiter } from '../../middleware/rate-limit.js';
import {
  AdminOrderListQuery,
  CreateOrderInput,
  TrackOrderQuery,
  UpdateOrderInput,
  UpdateStatusInput,
} from './orders.schema.js';
import * as service from './orders.service.js';

// ── Public: /api/orders ───────────────────────────────────────
export const ordersRouter = Router();

ordersRouter.post('/', orderLimiter, async (req, res) => {
  const order = await service.createOrder(parse(CreateOrderInput, req.body), req.ip);
  res.status(201).json({ order });
});

ordersRouter.get('/track', async (req, res) => {
  const { code, phone } = parse(TrackOrderQuery, req.query);
  res.set('Cache-Control', 'no-store');
  res.json({ order: await service.trackOrder(code, phone) });
});

// ── Admin: /api/admin/orders ──────────────────────────────────
export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireAdmin());

adminOrdersRouter.get('/', async (req, res) => {
  res.json(await service.listOrders(parse(AdminOrderListQuery, req.query)));
});

adminOrdersRouter.get('/:id', async (req, res) => {
  res.json(await service.getOrder(req.params.id));
});

adminOrdersRouter.patch('/:id/status', async (req, res) => {
  const { status, note } = parse(UpdateStatusInput, req.body);
  res.json(await service.updateOrderStatus(req.params.id, status, req.admin!.id, note));
});

adminOrdersRouter.patch('/:id', async (req, res) => {
  res.json(await service.updateOrder(req.params.id, parse(UpdateOrderInput, req.body)));
});
