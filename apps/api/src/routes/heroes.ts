import { asc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { heroes } from '../db/schema.js';

export async function heroesRoutes(app: FastifyInstance): Promise<void> {
  // Diambil dari Postgres (hasil seed Bagian 3), bukan dari OpenDota.
  app.get('/heroes', async () => db.select().from(heroes).orderBy(asc(heroes.localized_name)));
}
