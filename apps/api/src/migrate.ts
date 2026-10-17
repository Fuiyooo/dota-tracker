import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './db/client.js';
import { logger } from './logger.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Dari `src/` maupun `dist/`, naik tiga tingkat = root repo (berisi `drizzle/`).
export const migrationsFolder = path.resolve(here, '../../../drizzle');

/**
 * Terapkan migrasi yang belum jalan.
 *
 * Dipakai saat container start (`RUN_MIGRATIONS=true`) supaya deployment tidak
 * perlu langkah manual. `migrate()` mencatat progres di tabel
 * `drizzle.__drizzle_migrations`, jadi aman dijalankan berulang.
 */
export async function runMigrations(): Promise<void> {
  logger.info('menjalankan migrasi database', { migrationsFolder });
  await migrate(db, { migrationsFolder });
  logger.info('migrasi database selesai');
}
