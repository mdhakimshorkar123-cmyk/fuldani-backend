import { z } from 'zod';
import { normalizeBdPhone } from '../../lib/utils.js';

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
] as const;
export type OrderStatusT = (typeof ORDER_STATUSES)[number];

/** Allowed workflow transitions. Terminal states have no outgoing edges. */
export const STATUS_TRANSITIONS: Record<OrderStatusT, OrderStatusT[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

/** Statuses that put stock back on the shelf. */
export const RESTOCK_STATUSES: OrderStatusT[] = ['CANCELLED', 'RETURNED'];

const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const normalized = normalizeBdPhone(v);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'সঠিক মোবাইল নম্বর দিন (যেমন 01712345678)' });
      return z.NEVER;
    }
    return normalized;
  });

export const CreateOrderInput = z.object({
  customerName: z.string().trim().min(2, 'নাম লিখুন').max(80),
  phone,
  address: z.string().trim().min(10, 'সম্পূর্ণ ঠিকানা লিখুন').max(400),
  note: z.string().trim().max(500).optional(),
  deliveryZoneId: z.string().min(1, 'ডেলিভারি এরিয়া নির্বাচন করুন'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        colorName: z.string().trim().max(40).optional(),
        quantity: z.coerce.number().int().min(1).max(20),
      }),
    )
    .min(1, 'কার্ট খালি')
    .max(30),
});
export type CreateOrderInputT = z.output<typeof CreateOrderInput>;

export const TrackOrderQuery = z.object({
  code: z.string().trim().toUpperCase().min(4).max(20),
  phone,
});

export const AdminOrderListQuery = z.object({
  status: z.enum([...ORDER_STATUSES, 'ALL']).default('ALL'),
  q: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const UpdateStatusInput = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export const UpdateOrderInput = z
  .object({
    customerName: z.string().trim().min(2).max(80),
    phone,
    address: z.string().trim().min(5).max(400),
    adminNote: z.string().trim().max(1000).nullable(),
  })
  .partial();
