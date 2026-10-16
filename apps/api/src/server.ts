import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { env } from './env.js';
import { logger } from './logger.js';
import { OpenDotaError } from './opendota/client.js';
import { healthRoutes } from './routes/health.js';
import { heroesRoutes } from './routes/heroes.js';
import { playerStatsRoutes } from './routes/player-stats.js';
import { playersRoutes } from './routes/players.js';
import { trackingRoutes } from './routes/tracking.js';
import { StratzError } from './stratz/client.js';
import { SteamError } from './steam/client.js';

/**
 * Terjemahkan error internal menjadi status HTTP yang masuk akal.
 * Kesalahan dari layanan eksternal tidak boleh muncul sebagai 500 polos, dan
 * detail internal tidak boleh bocor ke luar.
 */
function toHttpError(error: FastifyError): { status: number; message: string } {
  if (error instanceof OpenDotaError || error instanceof StratzError || error instanceof SteamError) {
    if (error instanceof OpenDotaError && error.status === 404) {
      return { status: 404, message: 'Not found on OpenDota' };
    }
    return { status: 502, message: 'Upstream service failed' };
  }

  if (error.statusCode === 429) {
    return { status: 429, message: 'Too many requests, slow down' };
  }

  const status = error.statusCode ?? 500;
  return {
    status,
    message: status >= 500 ? 'Internal server error' : error.message,
  };
}

export function buildServer(): FastifyInstance {
  // logger: false karena kita memakai logger sendiri (Bagian 4).
  const app = Fastify({ logger: false });

  // Plugin keamanan didaftarkan SEBELUM route agar hook-nya mencakup semuanya.
  app.register(helmet);
  app.register(rateLimit, { max: env.RATE_LIMIT_MAX, timeWindow: '1 minute' });

  // CORS hanya diaktifkan kalau diminta lewat .env. Saat dev, FE memakai proxy
  // Vite sehingga CORS tidak diperlukan dan default yang longgar dihindari.
  const corsOrigin = env.CORS_ORIGIN?.trim();
  if (corsOrigin !== undefined && corsOrigin !== '') {
    app.register(cors, { origin: corsOrigin.split(',').map((origin) => origin.trim()) });
    logger.info('CORS diaktifkan', { origin: corsOrigin });
  }

  app.addHook('onResponse', async (request, reply) => {
    logger.info('http', {
      method: request.method,
      url: request.url,
      status: reply.statusCode,
      ms: Math.round(reply.elapsedTime),
    });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const { status, message } = toHttpError(error);
    logger.error('http: error', {
      method: request.method,
      url: request.url,
      status,
      error: error.message,
    });
    return reply.code(status).send({ error: message });
  });

  app.register(healthRoutes, { prefix: '/api' });
  app.register(heroesRoutes, { prefix: '/api' });
  app.register(playersRoutes, { prefix: '/api' });
  app.register(playerStatsRoutes, { prefix: '/api' });
  app.register(trackingRoutes, { prefix: '/api' });

  return app;
}
