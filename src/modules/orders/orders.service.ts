import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { invalidate } from '../../lib/cache.js';
import { HttpError, paginate } from '../../lib/http.js';
import { generateOrderCode, normalizeBdPhone } from '../../lib/utils.js';
import {
  type AdminOrderListQuery,
  type CreateOrderInputT,
  type OrderStatusT,
  RESTOCK_STATUSES,
  STATUS_TRANSITIONS,
} from './orders.schema.js';

// ── Public: place an order ────────────────────────────────────

export async function createOrder(input: CreateOrderInputT, ipAddress?: string) {
  // Merge duplicate lines (same product + colour).
  const lines = new Map<string, { productId: string; colorName?: string; quantity: number }>();
  for (const item of input.items) {
    const key = `${item.productId}::${item.colorName ?? ''}`;
    const prev = lines.get(key);
    lines.set(key, { ...item, quantity: (prev?.quantity ?? 0) + item.quantity });
  }
  const productIds = [...new Set([...lines.values()].map((l) => l.productId))];

  const order = await prisma.$transaction(
    async (tx) => {
      const zone = await tx.deliveryZone.findFirst({ where: { id: input.deliveryZoneId, isActive: true } });
      if (!zone) throw HttpError.badRequest('Validation failed', { deliveryZoneId: 'ডেলিভারি এরিয়া সঠিক নয়' });

      const products = await tx.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        include: { colors: { select: { name: true } } },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      // Prices always come from the database — never from the client.
      const items: Prisma.OrderItemCreateWithoutOrderInput[] = [];
      const qtyByProduct = new Map<string, number>();
      for (const line of lines.values()) {
        const product = byId.get(line.productId);
        if (!product) throw HttpError.badRequest('একটি পণ্য আর পাওয়া যাচ্ছে না। কার্ট আপডেট করুন।');

        const colorName =
          line.colorName && product.colors.some((c) => c.name === line.colorName) ? line.colorName : null;

        items.push({
          product: { connect: { id: product.id } },
          productName: product.name,
          productImage: product.images[0] ?? null,
          colorName,
          unitPrice: product.price,
          quantity: line.quantity,
          lineTotal: product.price * line.quantity,
        });
        qtyByProduct.set(product.id, (qtyByProduct.get(product.id) ?? 0) + line.quantity);
      }

      // Atomic, race-safe stock decrement.
      for (const [productId, qty] of qtyByProduct) {
        const { count } = await tx.product.updateMany({
          where: { id: productId, stock: { gte: qty } },
          data: { stock: { decrement: qty } },
        });
        if (count === 0) {
          const p = byId.get(productId)!;
          throw HttpError.conflict(`"${p.name}" — স্টকে পর্যাপ্ত পরিমাণ নেই (মাত্র ${p.stock}টি আছে)`);
        }
      }

      let code = generateOrderCode();
      while (await tx.order.findUnique({ where: { code }, select: { id: true } })) code = generateOrderCode();

      const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
      return tx.order.create({
        data: {
          code,
          customerName: input.customerName,
          phone: input.phone,
          address: input.address,
          note: input.note || null,
          deliveryZoneId: zone.id,
          deliveryZoneName: zone.name,
          deliveryFee: zone.fee,
          subtotal,
          total: subtotal + zone.fee,
          ipAddress: ipAddress ?? null,
          items: { create: items },
          statusLogs: { create: { status: 'PENDING', note: 'Order placed by customer' } },
        },
        select: { id: true, code: true, subtotal: true, deliveryFee: true, total: true, status: true, createdAt: true },
      });
    },
    { timeout: 15_000 },
  );

  await invalidate('products', 'stats');
  return order;
}

export async function trackOrder(code: string, phone: string) {
  const order = await prisma.order.findFirst({
    where: { code, phone },
    select: {
      code: true,
      status: true,
      customerName: true,
      deliveryZoneName: true,
      subtotal: true,
      deliveryFee: true,
      total: true,
      createdAt: true,
      items: { select: { productName: true, productImage: true, colorName: true, quantity: true, lineTotal: true } },
      statusLogs: { select: { status: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!order) throw HttpError.notFound('এই তথ্য দিয়ে কোনো অর্ডার পাওয়া যায়নি');
  return order;
}

// ── Admin ─────────────────────────────────────────────────────

export async function listOrders(query: z.output<typeof AdminOrderListQuery>) {
  const search = query.q;
  const phoneSearch = search ? normalizeBdPhone(search) : null;

  const where: Prisma.OrderWhereInput = {
    ...(query.status !== 'ALL' ? { status: query.status } : {}),
    ...(query.from || query.to ? { createdAt: { gte: query.from, lte: query.to } } : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { customerName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: phoneSearch ?? search } },
          ],
        }
      : {}),
  };

  const [items, total, grouped] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        code: true,
        customerName: true,
        phone: true,
        deliveryZoneName: true,
        total: true,
        status: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
  ]);

  const counts: Record<string, number> = { ALL: 0 };
  for (const g of grouped) {
    const n = (g._count as { _all: number })._all;
    counts[g.status] = n;
    counts.ALL! += n;
  }

  return { ...paginate(items, total, query.page, query.limit), counts };
}

export async function getOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { id: true, slug: true, stock: true } } } },
      statusLogs: {
        orderBy: { createdAt: 'asc' },
        include: { changedBy: { select: { id: true, name: true } } },
      },
    },
  });
  if (!order) throw HttpError.notFound('Order not found');
  return { order, allowedTransitions: STATUS_TRANSITIONS[order.status as OrderStatusT] };
}

export async function updateOrderStatus(id: string, status: OrderStatusT, adminId: string, note?: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw HttpError.notFound('Order not found');

    const current = order.status as OrderStatusT;
    if (!STATUS_TRANSITIONS[current].includes(status)) {
      throw HttpError.badRequest(`Cannot move order from ${current} to ${status}`);
    }

    // Guard against concurrent updates: only update if status is still what we read.
    const { count } = await tx.order.updateMany({ where: { id, status: current }, data: { status } });
    if (count === 0) throw HttpError.conflict('Order was modified by someone else. Refresh and try again.');

    if (RESTOCK_STATUSES.includes(status)) {
      for (const item of order.items) {
        if (!item.productId) continue;
        await tx.product.updateMany({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
    }

    await tx.orderStatusLog.create({ data: { orderId: id, status, note: note || null, changedById: adminId } });
  });

  await invalidate('stats', 'products');
  return getOrder(id);
}

export async function updateOrder(
  id: string,
  data: { customerName?: string; phone?: string; address?: string; adminNote?: string | null },
) {
  await prisma.order.update({ where: { id }, data });
  return getOrder(id);
}
