import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/http.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

function isPrismaKnownError(err: unknown): err is { code: string; meta?: Record<string, unknown> } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string' &&
    /^P\d{4}$/.test((err as { code: string }).code)
  );
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.path}` } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, details: err.details } });
    return;
  }

  if (isPrismaKnownError(err)) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { message: 'Duplicate value', details: err.meta } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { message: 'Record not found' } });
      return;
    }
  }

  // Malformed JSON body
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { message: 'Invalid JSON body' } });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({
    error: { message: 'Internal server error', ...(env.isProd ? {} : { stack: (err as Error)?.stack }) },
  });
}
