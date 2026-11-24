/**
 * Idempotent seed — safe to run multiple times.
 *   npm run db:seed
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type BadgeType } from '../src/generated/prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const img = (file: string) => `/flowers-photo/${file}`;
const unsplash = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=320&h=320&q=80`;

const categories = [
  { slug: 'silk-flower', name: 'প্রিমিয়াম ফুল সেট', image: img('857672429_1108193525126829_8382435049097800665_n.jpg'), sortOrder: 1 },
  { slug: 'indoor-plant', name: 'ইনডোর প্ল্যান্টস', image: img('856903870_1588195959204073_9019380452976216636_n.jpg'), sortOrder: 2 },
  { slug: 'floor-vase', name: 'লাক্সারি ফুলদানি ও ট্রি', image: img('861247349_1464462189222915_2521839650046409997_n.jpg'), sortOrder: 3 },
  { slug: 'bestseller', name: 'বেস্টসেলার কালেকশন', image: img('856047622_4449451515319768_7633340301144629158_n.jpg'), sortOrder: 4 },
];

interface SeedProduct {
  slug: string;
  name: string;
  typeLabel: string;
  description: string;
  price: number;
  comparePrice: number;
  rating: number;
  reviewCount: number;
  badgeType: BadgeType;
  badgeLabel: string;
  image: string;
  categories: string[];
  colors: [string, string][];
  isFeatured?: boolean;
}

const products: SeedProduct[] = [
  {
    slug: 'royal-cherry-blossom-geometric-vase',
    name: 'রয়্যাল চেরি ব্লসম ও জিওমেট্রিক সিরামিক ভেস',
    typeLabel: '🌸 প্রিমিয়াম সিল্ক ফুল সেট',
    description:
      'নরম সিল্কের পাপড়িতে তৈরি চেরি ব্লসম, সাথে হাতে গ্লেজ করা জিওমেট্রিক সিরামিক ভেস। ড্রয়িংরুম, ডাইনিং বা অফিস রিসেপশনে বছরের পর বছর একই রকম সতেজ থাকবে।',
    price: 2450,
    comparePrice: 2950,
    rating: 4.9,
    reviewCount: 128,
    badgeType: 'BESTSELLER',
    badgeLabel: '★ বেস্টসেলার',
    image: '847629237_2300214474096749_8399019294458563896_n.jpg',
    categories: ['silk-flower', 'floor-vase', 'bestseller'],
    colors: [['গোলাপি', '#f472b6'], ['পিওর হোয়াইট', '#ffffff'], ['সফট পিচ', '#fb923c']],
    isFeatured: true,
  },
  {
    slug: 'golden-asian-lily-fluted-pot',
    name: 'গোল্ডেন এশিয়ান লিলি ও ফ্লুটেড সিরামিক পট',
    typeLabel: '🌼 রিয়েল-টাচ লিলি সেট',
    description: 'রিয়েল-টাচ প্রযুক্তিতে তৈরি লিলি — ছুঁয়ে দেখলেও আসল ফুলের মতো অনুভূতি। ফ্লুটেড সিরামিক পটে সাজানো রেডি-টু-প্লেস অ্যারেঞ্জমেন্ট।',
    price: 1850,
    comparePrice: 2200,
    rating: 4.8,
    reviewCount: 95,
    badgeType: 'POPULAR',
    badgeLabel: '🔥 জনপ্রিয়',
    image: '856047622_4449451515319768_7633340301144629158_n.jpg',
    categories: ['silk-flower', 'bestseller'],
    colors: [['উজ্জ্বল হলুদ', '#eab308'], ['পিওর হোয়াইট', '#ffffff'], ['সানসেট অরেঞ্জ', '#f97316']],
  },
  {
    slug: 'evergreen-boxwood-bonsai-planter',
    name: 'লাক্সারি এভারগ্রিন বক্সউড বনসাই ট্রি ও প্ল্যান্টার',
    typeLabel: '🌿 লাক্সারি আর্ট ট্রি',
    description: 'পানি, রোদ বা যত্ন ছাড়াই চিরসবুজ। প্রিমিয়াম প্ল্যান্টারসহ বক্সউড বনসাই — লিভিং রুম ও এন্ট্রিওয়ের জন্য পারফেক্ট স্টেটমেন্ট পিস।',
    price: 3600,
    comparePrice: 4200,
    rating: 5.0,
    reviewCount: 74,
    badgeType: 'NEW',
    badgeLabel: '✦ নতুন কালেকশন',
    image: '856903870_1588195959204073_9019380452976216636_n.jpg',
    categories: ['indoor-plant', 'floor-vase'],
    colors: [['চিরসবুজ এমারেল্ড', '#15803d'], ['ডিপ ফরেস্ট', '#0f381e']],
  },
  {
    slug: 'venus-caladium-ceramic-pot',
    name: 'ভেনাস ক্যালাডিয়াম ইনডোর প্ল্যান্ট ও সিরামিক পট',
    typeLabel: '🌱 ভ্যারিয়েগেটেড লিফ পট',
    description: 'ভ্যারিয়েগেটেড পাতার ক্যালাডিয়াম — ডেস্ক, শেলফ বা জানালার পাশে রঙের ছোঁয়া আনতে আদর্শ।',
    price: 1650,
    comparePrice: 1950,
    rating: 4.7,
    reviewCount: 62,
    badgeType: 'OFFER',
    badgeLabel: '⚡ হট ডিল',
    image: '856965892_2345609756235448_5604435655555429761_n.jpg',
    categories: ['indoor-plant'],
    colors: [['লাইম গ্রিন', '#84cc16'], ['ডিপ গ্রিন', '#166534'], ['মিন্ট হোয়াইট', '#6ee7b7']],
  },
  {
    slug: 'royal-silk-magnolia-blossom-tree',
    name: 'রয়েল সিল্ক ম্যাগনোলিয়া ব্লসম ট্রি ও সিরামিক ভেস',
    typeLabel: '🌸 সিল্ক ব্লসম ফ্লাওয়ার ট্রি',
    description: 'বড় আকারের সিল্ক ম্যাগনোলিয়া ট্রি, যা যেকোনো কর্নারকে মুহূর্তেই লাক্সারি লুক দেয়। ওয়েডিং স্টেজ ও ইভেন্টেও জনপ্রিয়।',
    price: 2850,
    comparePrice: 3400,
    rating: 4.9,
    reviewCount: 162,
    badgeType: 'BESTSELLER',
    badgeLabel: '★ প্রিমিয়াম চয়েস',
    image: '857672429_1108193525126829_8382435049097800665_n.jpg',
    categories: ['silk-flower', 'bestseller'],
    colors: [['সফট পিংক', '#f472b6'], ['পিওর হোয়াইট', '#ffffff'], ['রুবি রোজ', '#e11d48']],
  },
  {
    slug: 'tropical-dracaena-palm-vase',
    name: 'ট্রপিক্যাল ড্রাসেনা পাম ও হোয়াইট ফ্লাওয়ার ভেস',
    typeLabel: '🌴 ডেকোরেটিভ ইনডোর পাম',
    description: 'ট্রপিক্যাল ড্রাসেনা পাম ও মিনিমাল হোয়াইট ভেস — মডার্ন ইন্টেরিয়রের সাথে দারুণ মানানসই।',
    price: 2200,
    comparePrice: 2600,
    rating: 4.8,
    reviewCount: 88,
    badgeType: 'POPULAR',
    badgeLabel: '🔥 ট্রেন্ডিং',
    image: '859315179_1145853798126921_8607683629099376409_n.jpg',
    categories: ['indoor-plant'],
    colors: [['গাঢ় সবুজ', '#15803d'], ['গোল্ডেন স্ট্রাইপ', '#ca8a04']],
  },
  {
    slug: 'golden-gladiolus-palm-floor-vase',
    name: 'গোল্ডেন গ্ল্যাডিওলাস ও পাম ফার্ন ফ্লোর ফুলদানি',
    typeLabel: '🌾 ফ্লোর স্ট্যান্ডিং কম্বো',
    description: 'ফ্লোর-স্ট্যান্ডিং লাক্সারি কম্বো — লম্বা গ্ল্যাডিওলাস ও পাম ফার্ন, প্রিমিয়াম ফ্লোর ভেসসহ।',
    price: 3250,
    comparePrice: 3900,
    rating: 4.9,
    reviewCount: 110,
    badgeType: 'BESTSELLER',
    badgeLabel: '★ লাক্সারি কম্বো',
    image: '861247349_1464462189222915_2521839650046409997_n.jpg',
    categories: ['silk-flower', 'floor-vase', 'bestseller'],
    colors: [['গোল্ডেন ইয়েলো', '#eab308'], ['ভেলভেট রেড', '#be123c'], ['রয়্যাল হোয়াইট', '#ffffff']],
  },
  {
    slug: 'schefflera-umbrella-bush-vase',
    name: 'শেফলেরা আমব্রেলা বুশ ও টেক্সচার্ড সিরামিক ভেস',
    typeLabel: '🌿 টেক্সচার্ড সিরামিক বুশ',
    description: 'ঘন পাতার শেফলেরা বুশ ও টেক্সচার্ড সিরামিক ভেস — অফিস ও ক্যাফে লাউঞ্জের জন্য লো-মেইনটেন্যান্স গ্রিনারি।',
    price: 1950,
    comparePrice: 2350,
    rating: 4.8,
    reviewCount: 79,
    badgeType: 'OFFER',
    badgeLabel: '⚡ বিশেষ অফার',
    image: '866549416_1688896149622976_829294618771065126_n.jpg',
    categories: ['indoor-plant', 'floor-vase'],
    colors: [['ভ্যারিয়েগেটেড গ্রিন', '#22c55e'], ['ডিপ ফরেস্ট', '#14532d']],
  },
];

const showcases = [
  ['বিয়ে ও ওয়েডিং স্টেজ', 'ওয়েডিং ডেকোরেশন', 'photo-1519225421980-715cb0215aed'],
  ['ড্রয়িংরুম ও লিভিং স্পেস', 'হোম ইন্টেরিয়র', 'photo-1618221195710-dd6b41faaea6'],
  ['কর্পোরেট অফিস ও ডেস্ক', 'রিসেপশন সজ্জা', 'photo-1497366216548-37526070297c'],
  ['ডাইনিং টেবিল সেন্টারপিস', 'রয়েল সেন্টারপিস', 'photo-1533777857889-4be7c70b33f7'],
  ['রেস্তোরাঁ ও ক্যাফে লাউঞ্জ', 'প্রিমিয়াম অ্যাম্বিয়েন্স', 'photo-1517248135467-4c7edcad34c4'],
  ['ফটোশুট ও ভিডিও স্টুডিও', 'ক্রিয়েটিভ ব্যাকড্রপ', 'photo-1516035069371-29a1b244cc32'],
  ['এন্ট্রিওয়ে ও ফয়ার কর্নার', 'লাক্সারি কর্নার লুক', 'photo-1586023492125-27b2c045efd7'],
  ['উপহার ও অ্যানিভার্সারি', 'স্মরণীয় উপহার', 'photo-1549465220-1a8b9238cd48'],
] as const;

async function main() {
  // Admin
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@shopnofuldani.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe@123';
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: process.env.SEED_ADMIN_NAME ?? 'Super Admin',
      passwordHash: await bcrypt.hash(password, 12),
      role: 'SUPER_ADMIN',
    },
  });
  console.log(`✓ admin: ${email}`);

  // Categories
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: c, create: c });
  }
  const catIds = Object.fromEntries(
    (await prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
  );
  console.log(`✓ ${categories.length} categories`);

  // Products
  for (const [i, p] of products.entries()) {
    const data = {
      name: p.name,
      typeLabel: p.typeLabel,
      description: p.description,
      price: p.price,
      comparePrice: p.comparePrice,
      rating: p.rating,
      reviewCount: p.reviewCount,
      badgeType: p.badgeType,
      badgeLabel: p.badgeLabel,
      images: [img(p.image)],
      isFeatured: p.isFeatured ?? false,
      sortOrder: i,
    };
    const categoriesSet = p.categories.map((slug) => ({ id: catIds[slug]! }));
    const colors = p.colors.map(([name, hex], idx) => ({ name, hex, sortOrder: idx }));

    const existing = await prisma.product.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (existing) {
      await prisma.productColor.deleteMany({ where: { productId: existing.id } });
      await prisma.product.update({
        where: { id: existing.id },
        data: { ...data, categories: { set: categoriesSet }, colors: { create: colors } },
      });
    } else {
      await prisma.product.create({
        data: { ...data, slug: p.slug, stock: 25, categories: { connect: categoriesSet }, colors: { create: colors } },
      });
    }
  }
  console.log(`✓ ${products.length} products`);

  // Showcases & delivery zones (only when empty, so admin edits are preserved)
  if ((await prisma.showcase.count()) === 0) {
    await prisma.showcase.createMany({
      data: showcases.map(([title, tag, id], sortOrder) => ({ title, tag, image: unsplash(id), sortOrder })),
    });
    console.log(`✓ ${showcases.length} showcases`);
  }
  if ((await prisma.deliveryZone.count()) === 0) {
    await prisma.deliveryZone.createMany({
      data: [
        { name: 'ঢাকার ভিতরে', fee: 80, sortOrder: 0 },
        { name: 'ঢাকার বাইরে', fee: 130, sortOrder: 1 },
      ],
    });
    console.log('✓ delivery zones');
  }
}

main()
  .then(() => console.log('🌸 Seed complete'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
