import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { mmrSnapshots, players } from '../db/schema.js';
import { getOpenDotaClient } from '../opendota/client.js';
import { epochNow, withSyncLog } from './logs.js';

export interface MmrChange {
  accountId: number;
  previousMmr: number | null;
  mmr: number | null;
  mmrDelta: number | null;
  previousRankTier: number | null;
  rankTier: number | null;
  rankDelta: number | null;
}

export interface SnapshotResult {
  accounts: number;
  snapshots: number;
  changes: MmrChange[];
  failures: Array<{ accountId: number; error: string }>;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Ambil `computed_mmr` + rank setiap akun yang `tracking_enabled`, lalu simpan
 * sebagai satu baris `mmr_snapshots` per akun.
 *
 * Catatan penting soal `source='estimate'`:
 * - MMR per match tidak tersedia (Valve maupun STRATZ - lihat Bagian 5), jadi
 *   `computed_mmr` di sini adalah **perkiraan** OpenDota, bukan MMR ranked resmi.
 *   Nilainya juga tidak selalu cocok dengan `rank_tier` (akun uji: Archon 1
 *   tetapi 3935.88). Jangan ditampilkan sebagai "MMR" tanpa catatan.
 * - `rank_tier` dan `leaderboard_rank` sendiri andal karena berasal dari Valve.
 *
 * Satu akun yang gagal **tidak** membatalkan batch; kegagalannya dikumpulkan
 * di `failures` (backoff per akun menyusul di Bagian 10).
 */
export async function snapshotMmr(): Promise<SnapshotResult> {
  return withSyncLog('mmr_snapshot', null, async () => {
    const tracked = await db
      .select({ account_id: players.account_id })
      .from(players)
      .where(eq(players.tracking_enabled, true));

    const recordedAt = epochNow();
    const result: SnapshotResult = {
      accounts: tracked.length,
      snapshots: 0,
      changes: [],
      failures: [],
    };

    for (const { account_id: accountId } of tracked) {
      try {
        const data = await getOpenDotaClient().getPlayer(accountId);
        if (data.profile === null) throw new Error('profil tidak ditemukan di OpenDota');

        const previousRows = await db
          .select({
            computed_mmr: mmrSnapshots.computed_mmr,
            rank_tier: mmrSnapshots.rank_tier,
          })
          .from(mmrSnapshots)
          .where(eq(mmrSnapshots.account_id, accountId))
          .orderBy(desc(mmrSnapshots.recorded_at))
          .limit(1);
        const previous = previousRows[0];

        await db.insert(mmrSnapshots).values({
          account_id: accountId,
          recorded_at: recordedAt,
          rank_tier: data.rank_tier,
          leaderboard_rank: data.leaderboard_rank,
          computed_mmr: data.computed_mmr,
          source: 'estimate',
        });
        result.snapshots += 1;

        const previousMmr = previous?.computed_mmr ?? null;
        const previousRankTier = previous?.rank_tier ?? null;

        result.changes.push({
          accountId,
          previousMmr,
          mmr: data.computed_mmr,
          mmrDelta:
            previousMmr !== null && data.computed_mmr !== null
              ? round2(data.computed_mmr - previousMmr)
              : null,
          previousRankTier,
          rankTier: data.rank_tier,
          rankDelta:
            previousRankTier !== null && data.rank_tier !== null
              ? data.rank_tier - previousRankTier
              : null,
        });
      } catch (error) {
        result.failures.push({ accountId, error: messageOf(error) });
      }
    }

    return result;
  });
}
