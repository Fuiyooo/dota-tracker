import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, '../../../drizzle');

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://dota:dota@localhost:5432/dota_tracker_test';

/**
 * Dijalankan sekali sebelum seluruh suite: pastikan database uji bisa
 * dihubungi, lalu terapkan migrasi.
 *
 * Database-nya sendiri TIDAK dibuat di sini - role `dota` tidak punya hak
 * CREATEDB. Pesan error di bawah menyebutkan perintah pembuatannya.
 */
export default async function setup(): Promise<void> {
  const client = postgres(TEST_DATABASE_URL, { max: 1 });

  try {
    await client`select 1`;
  } catch (error) {
    await client.end({ timeout: 5 }).catch(() => undefined);
    throw new Error(
      [
        '',
        'Database uji tidak bisa dihubungi.',
        `  URL: ${TEST_DATABASE_URL}`,
        '',
        'Buat sekali dengan:',
        '  sudo -u postgres createdb -O dota dota_tracker_test',
        '',
        'Atau set TEST_DATABASE_URL ke database lain yang boleh ditulis.',
        '',
      ].join('\n'),
      { cause: error },
    );
  }

  await migrate(drizzle(client), { migrationsFolder });
  await client.end({ timeout: 5 });
}
