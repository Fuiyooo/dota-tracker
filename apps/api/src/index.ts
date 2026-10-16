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

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info('menutup server', { signal });
    void app
      .close()
      .then(() => dbClient.end())
      .then(() => process.exit(0));
  });
}
