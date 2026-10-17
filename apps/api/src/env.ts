import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// `.env` ada di root workspace. Pakai lokasi file ini (bukan cwd) supaya tetap
// ketemu entah dijalankan dari root, dari apps/api, atau dari dist/.
const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(here, '../../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  STEAM_API_KEY: z.string().min(1),
  OPENDOTA_API_KEY: z.string().optional(),
  STRATZ_TOKEN: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
  /** Alamat bind. `127.0.0.1` aman untuk lokal; container perlu `0.0.0.0`. */
  HOST: z.string().default('127.0.0.1'),
  SYNC_INTERVAL_CRON: z.string().default('*/30 * * * *'),
  /** Daftar origin dipisah koma. Kosong = CORS tidak diaktifkan (FE lewat proxy Vite). */
  CORS_ORIGIN: z.string().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  /** Terapkan migrasi saat start (dipakai container produksi). */
  RUN_MIGRATIONS: z.enum(['true', 'false']).default('false'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Konfigurasi .env tidak lengkap:\n${detail}`);
  }
  return result.data;
}

export const env = loadEnv();
