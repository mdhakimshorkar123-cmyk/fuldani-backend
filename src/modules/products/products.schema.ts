import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #f472b6');
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[\p{L}\p{M}\p{N}]+(?:-[\p{L}\p{M}\p{N}]+)*$/u, 'Use letters, numbers and dashes only')
  .max(80);

const imageUrl = z
  .string()
  .trim()
  .refine((v) => v.startsWith('/') || /^https?:\/\//.test(v), 'Must be an absolute URL or a /path');

export const ProductListQuery = z.object({
  category: z.string().trim().optional(),
  /** Comma-separated product ids (used by the wishlist). */
  ids: z
    .string()
    .max(2000)
    .optional()
    .transform((s) => s?.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 48)),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['featured', 'newest', 'price_asc', 'price_desc', 'popular']).default('featured'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

export const AdminProductListQuery = ProductListQuery.extend({
  status: z.enum(['all', 'active', 'inactive', 'low_stock']).default('all'),
  sort: z.enum(['featured', 'newest', 'price_asc', 'price_desc', 'popular', 'stock_asc']).default('newest'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Field definitions WITHOUT defaults. (Zod 4 applies `.default()` even inside
 * `.partial()`, which would make PATCH requests silently reset fields.)
 */
const shape = {
  name: z.string().trim().min(2).max(160),
  slug: slug.optional().or(z.literal('').transform(() => undefined)),
  typeLabel: z.string().trim().max(80).nullable(),
  description: z.string().trim().max(5000).nullable(),
  price: z.coerce.number().int().min(0),
  comparePrice: z.coerce.number().int().min(0).nullable(),
  stock: z.coerce.number().int().min(0),
  badgeLabel: z.string().trim().max(40).nullable(),
  badgeType: z.enum(['BESTSELLER', 'POPULAR', 'NEW', 'OFFER']).nullable(),
  rating: z.coerce.number().min(0).max(5),
  reviewCount: z.coerce.number().int().min(0),
  images: z.array(imageUrl).max(12),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.coerce.number().int(),
  categoryIds: z.array(z.string().min(1)),
  colors: z.array(z.object({ name: z.string().trim().min(1).max(40), hex })).max(12),
};

export const ProductInput = z.object({
  ...shape,
  typeLabel: shape.typeLabel.optional().default(null),
  description: shape.description.optional().default(null),
  comparePrice: shape.comparePrice.optional().default(null),
  stock: shape.stock.default(0),
  badgeLabel: shape.badgeLabel.optional().default(null),
  badgeType: shape.badgeType.optional().default(null),
  rating: shape.rating.default(0),
  reviewCount: shape.reviewCount.default(0),
  images: shape.images.default([]),
  isActive: shape.isActive.default(true),
  isFeatured: shape.isFeatured.default(false),
  sortOrder: shape.sortOrder.default(0),
  categoryIds: shape.categoryIds.default([]),
  colors: shape.colors.default([]),
});

export const ProductPatch = z.object(shape).partial();

export type ProductInputT = z.output<typeof ProductInput>;
export type ProductPatchT = z.output<typeof ProductPatch>;
