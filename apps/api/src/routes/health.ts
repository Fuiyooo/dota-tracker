import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { getOpenDotaClient } from '../opendota/client.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    let database: 'up' | 'down' = 'up';
    try {
      await db.execute(sql`select 1`);
    } catch {
      database = 'down';
    }

    const opendota = getOpenDotaClient();

    return {
      ok: database === 'up',
      database,
      opendota: opendota.dailyUsage,
      cacheSize: opendota.cacheSize,
      uptimeSeconds: Math.round(process.uptime()),
    };
  });
}
