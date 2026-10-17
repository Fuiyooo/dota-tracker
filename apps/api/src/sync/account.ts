import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { players } from '../db/schema.js';
import { logger } from '../logger.js';
import { epochNow } from './logs.js';
import { syncPlayerMatches } from './matches.js';
import { snapshotAccount, type MmrChange } from './mmr.js';
import { syncPlayerProfile } from './players.js';

/** Backoff dasar saat sebuah akun gagal di-sync. */
const BASE_BACKOFF_SECONDS = 30 * 60;
const MAX_BACKOFF_SECONDS = 6 * 60 * 60;

/**
 * 30 menit, 1 jam, 2 jam, 4 jam, lalu mentok 6 jam.
 * Akun yang datanya privat akan gagal terus, jadi jangan sampai scheduler
 * memboroskan kuota OpenDota untuknya setiap putaran.
 */
export function backoffSeconds(failures: number): number {
  if (failures <= 0) return 0;
  return Math.min(BASE_BACKOFF_SECONDS * 2 ** (failures - 1), MAX_BACKOFF_SECONDS);
}

async function markAccountSuccess(accountId: number): Promise<void> {
  await db
    .update(players)
    .set({ sync_failures: 0, next_sync_at: null })
    .where(eq(players.account_id, accountId));
}

async function markAccountFailure(accountId: number): Promise<void> {
  const rows = await db
    .select({ sync_failures: players.sync_failures })
    .from(players)
    .where(eq(players.account_id, accountId))
    .limit(1);

  const failures = (rows[0]?.sync_failures ?? 0) + 1;
  const wait = backoffSeconds(failures);

  await db
    .update(players)
    .set({ sync_failures: failures, next_sync_at: epochNow() + wait })
    .where(eq(players.account_id, accountId));

  logger.warn('akun masuk backoff', { accountId, failures, waitSeconds: wait });
}

/**
 * Satu putaran lengkap untuk satu akun: profil -> match -> snapshot MMR.
 *
 * Keberhasilan mereset `sync_failures`; kegagalan menaikkannya dan memasang
 * `next_sync_at` supaya scheduler melewati akun ini sementara.
 */
export async function syncAccount(
  accountId: number,
  options: { matchLimit?: number } = {},
): Promise<{
  matches: { checked: number; alreadyStored: number; synced: number } | null;
  snapshot: MmrChange | null;
}> {
  try {
    await syncPlayerProfile(accountId);
    const matches = await syncPlayerMatches(accountId, { limit: options.matchLimit });
    const snapshot = await snapshotAccount(accountId);

    await markAccountSuccess(accountId);
    return { matches, snapshot };
  } catch (error) {
    await markAccountFailure(accountId);
    throw error;
  }
}
