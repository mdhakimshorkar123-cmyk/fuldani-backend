import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { cached, TTL } from '../../lib/cache.js';
import { parse } from '../../lib/http.js';
import { requireAdmin } from '../../middleware/auth.js';
import { LOW_STOCK_THRESHOLD } from '../products/products.service.js';

const TZ = 'Asia/Dhaka';
const EXCLUDED = ['CANCELLED', 'RETURNED'] as const;

const StatsQuery = z.object({ days: z.coerce.number().int().refine((d) => [7, 14, 30, 90].includes(d)).default(14) });

/** Midnight "today" in Dhaka (UTC+6, no DST), expressed as a UTC Date. */
function startOfDhakaDay(offsetDays = 0): Date {
  const now = new Date();
  const dhaka = new Date(now.getTime() + 6 * 3600_000);
  dhaka.setUTCHours(0, 0, 0, 0);
  return new Date(dhaka.getTime() - 6 * 3600_000 - offsetDays * 86_400_000);
}

async function computeStats(days: number) {
  const today = startOfDhakaDay();
  const since = startOfDhakaDay(days - 1);
  const prevSince = startOfDhakaDay(days * 2 - 1);
  const valid = { status: { notIn: [...EXCLUDED] } };

  const [
    revenueAgg,
    prevRevenueAgg,
    ordersInRange,
    prevOrdersInRange,
    todayAgg,
    pendingCount,
    activeProducts,
    lowStock,
    statusGroups,
    recentOrders,
    topProducts,
    series,
  ] = await Promise.all([
    prisma.order.aggregate({ where: { ...valid, createdAt: { gte: since } }, _sum: { total: true }, _count: true }),
    prisma.order.aggregate({ where: { ...valid, createdAt: { gte: prevSince, lt: since } }, _sum: { total: true } }),
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.order.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
    prisma.order.aggregate({ where: { ...valid, createdAt: { gte: today } }, _sum: { total: true }, _count: true }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.findMany({
      where: { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD } },
      select: { id: true, name: true, stock: true, images: true },
      orderBy: { stock: 'asc' },
      take: 6,
    }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true }, where: { createdAt: { gte: since } }, orderBy: { status: 'asc' } }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, code: true, customerName: true, total: true, status: true, createdAt: true },
    }),
    prisma.orderItem.groupBy({
      by: ['productName'],
      where: { order: { ...valid, createdAt: { gte: since } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 5,
    }),
    prisma.$queryRaw<{ day: string; orders: number; revenue: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS orders,
             COALESCE(SUM("total") FILTER (WHERE "status"::text NOT IN ('CANCELLED', 'RETURNED')), 0)::int AS revenue
      FROM "Order"
      WHERE "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1`,
  ]);

  // Fill gaps so the chart has one point per day.
  const byDay = new Map(series.map((r) => [r.day, r]));
  const filledSeries = Array.from({ length: days }, (_, i) => {
    const d = new Date(since.getTime() + 6 * 3600_000 + i * 86_400_000).toISOString().slice(0, 10);
    const row = byDay.get(d);
    return { day: d, orders: row?.orders ?? 0, revenue: row?.revenue ?? 0 };
  });

  const revenue = revenueAgg._sum.total ?? 0;
  const prevRevenue = prevRevenueAgg._sum.total ?? 0;
  const pct = (cur: number, prev: number) => (prev === 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10);

  return {
    rangeDays: days,
    kpis: {
      revenue,
      revenueChange: pct(revenue, prevRevenue),
      orders: ordersInRange,
      ordersChange: pct(ordersInRange, prevOrdersInRange),
      avgOrderValue: revenueAgg._count ? Math.round(revenue / revenueAgg._count) : 0,
      todayRevenue: todayAgg._sum.total ?? 0,
      todayOrders: todayAgg._count,
      pendingOrders: pendingCount,
      activeProducts,
    },
    statusBreakdown: statusGroups.map((g) => ({ status: g.status, count: (g._count as { _all: number })._all })),
    series: filledSeries,
    topProducts: topProducts.map((t) => ({
      name: t.productName,
      quantity: t._sum?.quantity ?? 0,
      revenue: t._sum?.lineTotal ?? 0,
    })),
    lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, stock: p.stock, image: p.images[0] ?? null })),
    recentOrders,
    generatedAt: new Date().toISOString(),
  };
}

export const adminDashboardRouter = Router();
adminDashboardRouter.use(requireAdmin());

adminDashboardRouter.get('/stats', async (req, res) => {
  const { days } = parse(StatsQuery, req.query);
  res.json(await cached('stats', `dashboard:${days}`, TTL.short, () => computeStats(days)));
});
