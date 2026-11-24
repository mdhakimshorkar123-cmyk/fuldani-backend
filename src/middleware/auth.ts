import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http.js';
import type { Role } from '../generated/prisma/client.js';

export const AUTH_COOKIE = 'sf_admin';

interface TokenPayload {
  sub: string;
  role: Role;
}

export function signToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role } satisfies TokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: env.JWT_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/' });
}

function extractToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[AUTH_COOKIE] as string | undefined;
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return undefined;
}

/** Requires a valid, active admin session. Optionally restrict to roles. */
export function requireAdmin(...roles: Role[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) throw HttpError.unauthorized();

    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as unknown as TokenPayload;
    } catch {
      throw HttpError.unauthorized('Session expired');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) throw HttpError.unauthorized();
    if (roles.length && !roles.includes(user.role)) throw HttpError.forbidden();

    req.admin = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
  };
}
