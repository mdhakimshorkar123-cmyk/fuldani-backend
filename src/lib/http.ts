import type { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(msg = 'Bad request', details?: unknown) {
    return new HttpError(400, msg, details);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new HttpError(401, msg);
  }
  static forbidden(msg = 'Forbidden') {
    return new HttpError(403, msg);
  }
  static notFound(msg = 'Not found') {
    return new HttpError(404, msg);
  }
  static conflict(msg = 'Conflict') {
    return new HttpError(409, msg);
  }
}

/** Parse untrusted input with a Zod schema; throws a 400 with field errors on failure. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || '_';
      fields[path] ??= issue.message;
    }
    throw HttpError.badRequest('Validation failed', fields);
  }
  return result.data;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
