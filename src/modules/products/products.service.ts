import type { z } from 'zod';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { cached, invalidate, keyOf, TTL } from '../../lib/cache';
import { HttpError, paginate } from '../../lib/http';
import { shortId, slugify } from '../../lib/utils';
import type { AdminProductListQuery, ProductInputT, ProductListQuery, ProductPatchT } from './products.schema';

export const LOW_STOCK_THRESHOLD = 5;

export const productInclude = {
  colors: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, hex: true } },
  categories: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.ProductInclude;

function orderByFor(sort: string): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'newest':
      return [{ createdAt: 'desc' }];
    case 'price_asc':
      return [{ price: 'asc' }];
    case 'price_desc':
      return [{ price: 'desc' }];
    case 'popular':
      return [{ reviewCount: 'desc' }, { rating: 'desc' }];
    case 'stock_asc':
      return [{ stock: 'asc' }];
    default:
      return [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }];
  }
}

function searchFilter(q?: string): Prisma.ProductWhereInput {
  if (!q) return {};
  return {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { typeLabel: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
    ],
  };
}

// ── Public ────────────────────────────────────────────────────

export function listPublicProducts(query: z.output<typeof ProductListQuery>) {
  return cached('products', `list:${keyOf(query)}`, TTL.medium, async () => {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(query.category && query.category !== 'all'
        ? { categories: { some: { slug: query.category, isActive: true } } }
        : {}),
      ...(query.ids?.length ? { id: { in: query.ids } } : {}),
      ...searchFilter(query.q),
    };
    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: orderByFor(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.product.count({ where }),
    ]);
    return paginate(items, total, query.page, query.limit);
  });
}

export function getFeaturedProduct() {
  return cached('products', 'featured', TTL.medium, () =>
    prisma.product.findFirst({
      where: { isActive: true, isFeatured: true },
      include: productInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
  );
}

export function getPublicProductBySlug(slug: string) {
  return cached('products', `slug:${slug}`, TTL.medium, async () => {
    const product = await prisma.product.findFirst({
      where: { slug, isActive: true },
      include: productInclude,
    });
    if (!product) return null;

    const related = await prisma.product.findMany({
      where: {
        isActive: true,
        id: { not: product.id },
        categories: { some: { id: { in: product.categories.map((c) => c.id) } } },
      },
      include: productInclude,
      orderBy: orderByFor('featured'),
      take: 4,
    });
    return { product, related };
  });
}

// ── Admin ─────────────────────────────────────────────────────

export async function listAdminProducts(query: z.output<typeof AdminProductListQuery>) {
  const statusWhere: Prisma.ProductWhereInput =
    query.status === 'active'
      ? { isActive: true }
      : query.status === 'inactive'
        ? { isActive: false }
        : query.status === 'low_stock'
          ? { stock: { lte: LOW_STOCK_THRESHOLD } }
          : {};

  const where: Prisma.ProductWhereInput = {
    ...statusWhere,
    ...(query.category && query.category !== 'all' ? { categories: { some: { slug: query.category } } } : {}),
    ...searchFilter(query.q),
  };

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: { ...productInclude, _count: { select: { orderItems: true } } },
      orderBy: orderByFor(query.sort),
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.product.count({ where }),
  ]);
  return paginate(items, total, query.page, query.limit);
}

export async function getAdminProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!product) throw HttpError.notFound('Product not found');
  return product;
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || `product-${shortId()}`;
  let candidate = root;
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!clash || clash.id === excludeId) return candidate;
    candidate = `${root}-${shortId(4)}`;
  }
  throw HttpError.conflict('Could not generate a unique slug');
}

function validatePricing(price?: number, comparePrice?: number | null) {
  if (price !== undefined && comparePrice != null && comparePrice <= price) {
    throw HttpError.badRequest('Validation failed', { comparePrice: 'Compare price must be greater than price' });
  }
}

export async function createProduct(input: ProductInputT) {
  validatePricing(input.price, input.comparePrice);
  const { categoryIds, colors, slug, ...data } = input;

  const product = await prisma.product.create({
    data: {
      ...data,
      slug: await uniqueSlug(slug ?? input.name),
      categories: { connect: categoryIds.map((id) => ({ id })) },
      colors: { create: colors.map((c, i) => ({ ...c, sortOrder: i })) },
    },
    include: productInclude,
  });
  await invalidate('products', 'categories', 'stats');
  return product;
}

export async function updateProduct(id: string, input: ProductPatchT) {
  const existing = await prisma.product.findUnique({ where: { id }, select: { price: true, comparePrice: true } });
  if (!existing) throw HttpError.notFound('Product not found');

  validatePricing(input.price ?? existing.price, input.comparePrice !== undefined ? input.comparePrice : existing.comparePrice);

  const { categoryIds, colors, slug, ...data } = input;

  const product = await prisma.$transaction(async (tx) => {
    if (colors) await tx.productColor.deleteMany({ where: { productId: id } });
    return tx.product.update({
      where: { id },
      data: {
        ...data,
        ...(slug ? { slug: await uniqueSlug(slug, id) } : {}),
        ...(categoryIds ? { categories: { set: categoryIds.map((cid) => ({ id: cid })) } } : {}),
        ...(colors ? { colors: { create: colors.map((c, i) => ({ ...c, sortOrder: i })) } } : {}),
      },
      include: productInclude,
    });
  });
  await invalidate('products', 'categories', 'stats');
  return product;
}

export async function deleteProduct(id: string) {
  // Order items keep a snapshot (name/price/image), so history survives deletion.
  await prisma.product.delete({ where: { id } });
  await invalidate('products', 'categories', 'stats');
}
