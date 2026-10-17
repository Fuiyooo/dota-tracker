import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { mmrSnapshots } from '../db/schema.js';
import { getStratzClient } from '../stratz/client.js';
import { withSyncLog } from './logs.js';

/**
 * Impor HISTORI RANK dari STRATZ ke `mmr_snapshots` dengan `source='stratz'`.
 *
 * Kenapa ini berguna: job snapshot (Bagian 7) hanya mencatat mulai sekarang,
 * sehingga grafik butuh berbulan-bulan sebelum terlihat. STRATZ menyimpan
 * histori rank pemain sampai bertahun-tahun ke belakang (akun uji: 49 entri
 * sejak Mei 2021), dan tiap entri sudah membawa waktunya sendiri.
 *
 * Yang diisi hanya `rank_tier`. `computed_mmr` sengaja `null` karena STRATZ
 * **tidak menyediakan MMR** (lihat `stratz/types.ts`). Akibatnya garis MMR di
 * grafik tetap kosong untuk titik-titik ini - dan itu memang keadaan sebenarnya.
 *
 * Catatan: rank dari STRATZ bisa tertinggal dari rank_tier OpenDota (pada akun
 * uji: 35 vs 41), jadi entri lama ini bukan pengganti data terkini.
 */
export async function backfillRanksFromStratz(
  accountId: number,
): Promise<{ inserted: number; skipped: number; total: number }> {
  return withSyncLog('rank_backfill', accountId, async () => {
    const player = await getStratzClient().getPlayer(accountId);

    const existing = new Set(
      (
        await db
          .select({ recorded_at: mmrSnapshots.recorded_at })
          .from(mmrSnapshots)
          .where(eq(mmrSnapshots.account_id, accountId))
      ).map((row) => row.recorded_at),
    );

    const rows = player.ranks
      .filter((rank) => !existing.has(rank.asOfDateTime))
      .map((rank) => ({
        account_id: accountId,
        recorded_at: rank.asOfDateTime,
        rank_tier: rank.rank,
        leaderboard_rank: null,
        computed_mmr: null,
        source: 'stratz',
      }));

    if (rows.length > 0) {
      await db.insert(mmrSnapshots).values(rows);
    }

    return {
      inserted: rows.length,
      skipped: player.ranks.length - rows.length,
      total: player.ranks.length,
    };
  });
}
