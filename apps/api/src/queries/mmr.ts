import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { matches, matchPlayers, mmrSnapshots } from '../db/schema.js';

export interface MmrHistoryEntry {
  id: number;
  recorded_at: number;
  rank_tier: number | null;
  leaderboard_rank: number | null;
  computed_mmr: number | null;
  source: string;
  /** Selisih `computed_mmr` terhadap snapshot sebelumnya (null bila salah satu kosong). */
  mmr_delta: number | null;
  /** Selisih `rank_tier` terhadap snapshot sebelumnya. */
  rank_delta: number | null;
  /** Match terakhir milik pemain pada atau sebelum `recorded_at`. */
  match_id: number | null;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Histori snapshot MMR/rank, terurut lama -> baru.
 *
 * Delta TIDAK disimpan di tabel (skema `mmr_snapshots` tidak punya kolomnya),
 * melainkan dihitung di sini terhadap snapshot sebelumnya. Setiap entri juga
 * "diatribusikan" ke match terakhir yang dimiliki pemain pada atau sebelum
 * `recorded_at`, sehingga perubahan bisa dikaitkan dengan match pemicunya.
 */
export async function listMmrHistory(accountId: number, limit = 200): Promise<MmrHistoryEntry[]> {
  const snapshots = await db
    .select()
    .from(mmrSnapshots)
    .where(eq(mmrSnapshots.account_id, accountId))
    .orderBy(asc(mmrSnapshots.recorded_at))
    .limit(limit);

  const ownedMatches = await db
    .select({ match_id: matchPlayers.match_id, start_time: matches.start_time })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.match_id, matchPlayers.match_id))
    .where(eq(matchPlayers.account_id, accountId))
    .orderBy(asc(matches.start_time));

  const entries: MmrHistoryEntry[] = [];
  let matchIndex = -1;

  for (let index = 0; index < snapshots.length; index += 1) {
    const snapshot = snapshots[index];
    if (snapshot === undefined) continue;

    const previous = snapshots[index - 1];

    // Geser penunjuk ke match terakhir yang tidak melewati waktu snapshot.
    while (matchIndex + 1 < ownedMatches.length) {
      const next = ownedMatches[matchIndex + 1];
      if (next === undefined || next.start_time > snapshot.recorded_at) break;
      matchIndex += 1;
    }

    const previousMmr = previous?.computed_mmr ?? null;
    const previousRankTier = previous?.rank_tier ?? null;
    const matchedMatch = matchIndex >= 0 ? ownedMatches[matchIndex] : undefined;

    entries.push({
      id: snapshot.id,
      recorded_at: snapshot.recorded_at,
      rank_tier: snapshot.rank_tier,
      leaderboard_rank: snapshot.leaderboard_rank,
      computed_mmr: snapshot.computed_mmr,
      source: snapshot.source,
      mmr_delta:
        previousMmr !== null && snapshot.computed_mmr !== null
          ? round2(snapshot.computed_mmr - previousMmr)
          : null,
      rank_delta:
        previousRankTier !== null && snapshot.rank_tier !== null
          ? snapshot.rank_tier - previousRankTier
          : null,
      match_id: matchedMatch?.match_id ?? null,
    });
  }

  return entries;
}
