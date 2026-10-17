import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://dota:dota@localhost:5432/dota_tracker_test';

export default defineConfig({
  test: {
    // File tes integrasi memakai satu database bersama, jadi jangan dijalankan
    // paralel antar file (mereka saling mengosongkan tabel).
    fileParallelism: false,
    globalSetup: ['./test/setup-db.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      LOG_LEVEL: 'error',
    },
  },
});
