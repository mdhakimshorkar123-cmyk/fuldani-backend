import { Router } from 'express';
import { compare, hash, hashSync } from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { HttpError, parse } from '../../lib/http.js';
import { clearAuthCookie, requireAdmin, setAuthCookie, signToken } from '../../middleware/auth.js';
import { loginLimiter } from '../../middleware/rate-limit.js';

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

// Used to keep login timing constant when the email doesn't exist.
const DUMMY_HASH = hashSync('timing-safe-dummy', 10);

export const authRouter = Router();

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = parse(LoginSchema, req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) throw HttpError.unauthorized('ইমেইল বা পাসওয়ার্ড ভুল (Invalid credentials)');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  setAuthCookie(res, signToken(user.id, user.role));

  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAdmin(), (req, res) => {
  res.json({ user: req.admin });
});

authRouter.post('/change-password', requireAdmin(), async (req, res) => {
  const { currentPassword, newPassword } = parse(ChangePasswordSchema, req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.admin!.id } });
  if (!(await compare(currentPassword, user.passwordHash))) {
    throw HttpError.badRequest('Current password is incorrect');
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hash(newPassword, 12) },
  });
  res.status(204).end();
});
