import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { syncLogs } from '../db/schema.js';
import { logger } from '../logger.js';

export type SyncScope =
  'heroes' | 'profile' | 'matches' | 'match_detail' | 'mmr_snapshot' | 'rank_backfill';
export type SyncStatus = 'running' | 'success' | 'error';

/** Semua kolom waktu di proyek ini memakai epoch detik, bukan timestamptz. */
export function epochNow(): number {
  return Math.floor(Date.now() / 1000);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Jalankan sebuah langkah sync sambil mencatatnya ke `sync_logs`.
 *
 * Satu baris log per pemanggilan: dibuat dengan status `running`, lalu diubah
 * menjadi `success` atau `error` (beserta pesannya). Error tetap dilempar ulang
 * supaya pemanggil bisa memutuskan lanjut atau berhenti.
 */
export async function withSyncLog<T>(
  scope: SyncScope,
  accountId: number | null,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = epochNow();

  const inserted = await db
    .insert(syncLogs)
    .values({ account_id: accountId, scope, started_at: startedAt, status: 'running' })
    .returning({ id: syncLogs.id });

  const logId = inserted[0]?.id;
  if (logId === undefined) throw new Error('gagal membuat baris sync_logs');

  try {
    const result = await fn();
    await db
      .update(syncLogs)
      .set({ status: 'success', finished_at: epochNow() })
      .where(eq(syncLogs.id, logId));
    logger.info('sync selesai', { scope, accountId });
    return result;
  } catch (error) {
    const message = messageOf(error);
    await db
      .update(syncLogs)
      .set({ status: 'error', finished_at: epochNow(), error: message.slice(0, 2000) })
      .where(eq(syncLogs.id, logId));
    logger.error('sync gagal', { scope, accountId, error: message });
    throw error;
  }
}
