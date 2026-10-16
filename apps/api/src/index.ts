import { client as dbClient } from './db/client.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { buildServer } from './server.js';

const app = buildServer();

try {
  await app.listen({ port: env.PORT, host: '127.0.0.1' });
} catch (error) {
  logger.error('gagal menjalankan server', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}

const SHUTDOWN_TIMEOUT_MS = 5_000;

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info('menutup server', { signal });

    // Jaring pengaman: jangan sampai proses menggantung tanpa batas.
    const forceExit = setTimeout(() => {
      logger.warn('penutupan melebihi batas waktu, keluar paksa', {
        timeoutMs: SHUTDOWN_TIMEOUT_MS,
      });
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    void app
      .close()
      // Tanpa `timeout`, postgres.js menunggu koneksi menutup tanpa batas.
      .then(() => dbClient.end({ timeout: 5 }))
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error('gagal menutup dengan bersih', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      });
  });
}
