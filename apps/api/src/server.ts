import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { logger } from './logger.js';
import { OpenDotaError } from './opendota/client.js';
import { healthRoutes } from './routes/health.js';
import { heroesRoutes } from './routes/heroes.js';
import { playersRoutes } from './routes/players.js';

/**
 * Terjemahkan error internal menjadi status HTTP yang masuk akal.
 * Kesalahan dari OpenDota tidak boleh muncul sebagai 500 polos, dan detail
 * internal tidak boleh bocor ke luar.
 */
function toHttpError(error: FastifyError): { status: number; message: string } {
  if (error instanceof OpenDotaError) {
    if (error.status === 404) {
      return { status: 404, message: 'Not found on OpenDota' };
    }
    return { status: 502, message: 'Failed to fetch data from OpenDota' };
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

  return app;
}
