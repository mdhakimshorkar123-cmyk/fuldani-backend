import express, { Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { isRedisReady } from './lib/redis';
import { apiLimiter } from './middleware/rate-limit';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.routes';
import { adminProductsRouter, productsRouter } from './modules/products/products.routes';
import { adminCategoriesRouter, categoriesRouter } from './modules/categories/categories.routes';
import { adminOrdersRouter, ordersRouter } from './modules/orders/orders.routes';
import { adminDeliveryZonesRouter, deliveryZonesRouter } from './modules/delivery-zones/delivery-zones.routes';
import { adminShowcasesRouter, showcasesRouter } from './modules/showcases/showcases.routes';
import { adminDashboardRouter } from './modules/dashboard/dashboard.routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Render/Railway/Nginx/Vercel proxy

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    }),
  );

  app.get('/health', async (_req, res) => {
    let db = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      /* reported below */
    }
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db, redis: isRedisReady(), uptime: process.uptime() });
  });

  const api = Router();
  api.use(apiLimiter);

  // Public storefront API
  api.use('/products', productsRouter);
  api.use('/categories', categoriesRouter);
  api.use('/showcases', showcasesRouter);
  api.use('/delivery-zones', deliveryZonesRouter);
  api.use('/orders', ordersRouter);

  // Admin API (every router enforces requireAdmin)
  api.use('/admin/auth', authRouter);
  api.use('/admin/dashboard', adminDashboardRouter);
  api.use('/admin/products', adminProductsRouter);
  api.use('/admin/categories', adminCategoriesRouter);
  api.use('/admin/orders', adminOrdersRouter);
  api.use('/admin/delivery-zones', adminDeliveryZonesRouter);
  api.use('/admin/showcases', adminShowcasesRouter);

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
