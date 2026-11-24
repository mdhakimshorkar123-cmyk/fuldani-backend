import type { Role } from '../generated/prisma/client';

declare global {
  namespace Express {
    interface Request {
      admin?: { id: string; email: string; name: string; role: Role };
    }
  }
}

export {};
