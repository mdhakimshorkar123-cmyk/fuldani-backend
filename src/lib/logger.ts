import { pino } from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.isProd ? 'info' : 'debug',
  redact: ['req.headers.cookie', 'req.headers.authorization', 'password', 'passwordHash'],
  ...(env.isProd
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }),
});
