import { schedule, shutdown, validate, type ScheduledTask } from 'node-cron';
import { env } from './env.js';
import { logger } from './logger.js';
import { snapshotMmr } from './sync/mmr.js';

let snapshotTask: ScheduledTask | undefined;

/**
 * Job berkala: snapshot MMR/rank semua akun yang di-track.
 *
 * `noOverlap` mencegah dua snapshot berjalan bersamaan bila eksekusi sebelumnya
 * belum selesai, dan `unref` membuat timer ini tidak menahan proses tetap hidup
 * saat shutdown.
 */
export function startScheduler(): void {
  if (!validate(env.SYNC_INTERVAL_CRON)) {
    logger.warn('SYNC_INTERVAL_CRON bukan ekspresi cron yang valid, scheduler tidak dijalankan', {
      cron: env.SYNC_INTERVAL_CRON,
    });
    return;
  }

  snapshotTask = schedule(
    env.SYNC_INTERVAL_CRON,
    () => {
      void snapshotMmr().catch((error: unknown) => {
        logger.error('snapshot MMR gagal', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
    { name: 'snapshot-mmr', noOverlap: true, unref: true },
  );

  logger.info('scheduler dijalankan', { cron: env.SYNC_INTERVAL_CRON, task: 'snapshot-mmr' });
}

export async function stopScheduler(): Promise<void> {
  snapshotTask?.destroy();
  snapshotTask = undefined;
  await shutdown();
}
