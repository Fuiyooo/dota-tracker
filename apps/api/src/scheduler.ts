import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import PQueue from 'p-queue';
import { schedule, shutdown, validate, type ScheduledTask } from 'node-cron';
import { db } from './db/client.js';
import { players } from './db/schema.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { syncAccount } from './sync/account.js';
import { epochNow } from './sync/logs.js';

/**
 * Batas jumlah akun yang diproses bersamaan.
 * Client OpenDota sendiri sudah membatasi 60 permintaan/menit, jadi angka ini
 * hanya mencegah lonjakan proses saat akun yang di-track sudah banyak.
 */
const ACCOUNT_CONCURRENCY = 2;

const queue = new PQueue({ concurrency: ACCOUNT_CONCURRENCY });

export interface ScheduledSyncResult {
  tracked: number;
  due: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

/**
 * Satu putaran scheduler: sync semua akun yang di-track DAN tidak sedang
 * dalam masa backoff. Akun yang gagal akan otomatis ditunda oleh
 * `syncAccount()` (lihat `backoffSeconds`).
 */
export async function runScheduledSync(): Promise<ScheduledSyncResult> {
  const now = epochNow();

  const due = await db
    .select({ account_id: players.account_id })
    .from(players)
    .where(
      and(
        eq(players.tracking_enabled, true),
        or(isNull(players.next_sync_at), lte(players.next_sync_at, now)),
      ),
    );

  const totals = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(players)
    .where(eq(players.tracking_enabled, true));
  const tracked = totals[0]?.count ?? 0;

  let succeeded = 0;
  let failed = 0;

  await Promise.all(
    due.map(({ account_id: accountId }) =>
      queue.add(async () => {
        try {
          const result = await syncAccount(accountId, { matchLimit: 20 });
          succeeded += 1;
          logger.info('scheduler: akun tersinkron', {
            accountId,
            newMatches: result.matches?.synced ?? 0,
            mmrDelta: result.snapshot?.mmrDelta ?? null,
            rankDelta: result.snapshot?.rankDelta ?? null,
          });
        } catch (error) {
          failed += 1;
          logger.error('scheduler: akun gagal', {
            accountId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    ),
  );

  const result: ScheduledSyncResult = {
    tracked,
    due: due.length,
    succeeded,
    failed,
    skipped: tracked - due.length,
  };

  logger.info('scheduler: putaran selesai', { ...result });
  return result;
}

let syncTask: ScheduledTask | undefined;

/**
 * Job berkala: sync profil + match + snapshot MMR untuk semua akun yang
 * di-track, dengan batas konkurensi dan backoff per akun.
 *
 * `noOverlap` mencegah dua putaran berjalan bersamaan, `unref` membuat timer
 * tidak menahan proses saat shutdown.
 */
export function startScheduler(): void {
  if (!validate(env.SYNC_INTERVAL_CRON)) {
    logger.warn('SYNC_INTERVAL_CRON bukan ekspresi cron yang valid, scheduler tidak dijalankan', {
      cron: env.SYNC_INTERVAL_CRON,
    });
    return;
  }

  syncTask = schedule(
    env.SYNC_INTERVAL_CRON,
    () => {
      void runScheduledSync().catch((error: unknown) => {
        logger.error('scheduler: putaran gagal total', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
    { name: 'sync-all', noOverlap: true, unref: true },
  );

  logger.info('scheduler dijalankan', {
    cron: env.SYNC_INTERVAL_CRON,
    task: 'sync-all',
    concurrency: ACCOUNT_CONCURRENCY,
  });
}

export async function stopScheduler(): Promise<void> {
  await syncTask?.destroy();
  syncTask = undefined;
  await queue.onIdle();
  await shutdown();
}
