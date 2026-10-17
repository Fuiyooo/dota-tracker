import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { matches, matchPlayers } from '../db/schema.js';
import { logger } from '../logger.js';
import { getOpenDotaClient } from '../opendota/client.js';
import { epochNow, withSyncLog } from './logs.js';

/**
 * Simpan satu match beserta SELURUH pemainnya.
 *
 * Catatan penting:
 * - `/matches/{id}` **tidak menyediakan `average_rank`** di level atas, jadi
 *   dihitung dari rata-rata `rank_tier` kesepuluh pemain (yang punya rank).
 * - Pemain dengan `account_id` kosong (profil privat) **dilewati**, karena
 *   kolom `match_players.account_id` NOT NULL. Pada match uji: 3 dari 10.
 * - `mmr_before`/`mmr_after`/`mmr_delta` dibiarkan `null`: STRATZ terbukti
 *   tidak menyediakan MMR per match (lihat `apps/api/src/stratz/types.ts`).
 */
export async function syncMatchDetail(matchId: number): Promise<{
  matchId: number;
  storedPlayers: number;
  skippedPlayers: number;
}> {
  const data = await getOpenDotaClient().getMatch(matchId);

  const ranks = data.players
    .map((player) => player.rank_tier)
    .filter((rank): rank is number => rank !== null && rank > 0);
  const averageRank =
    ranks.length > 0 ? Math.round(ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length) : null;

  await db
    .insert(matches)
    .values({
      match_id: data.match_id,
      start_time: data.start_time,
      duration: data.duration,
      radiant_win: data.radiant_win,
      game_mode: data.game_mode,
      lobby_type: data.lobby_type,
      average_rank: averageRank,
      radiant_score: data.radiant_score,
      dire_score: data.dire_score,
    })
    .onConflictDoUpdate({
      target: matches.match_id,
      set: {
        start_time: sql`excluded.start_time`,
        duration: sql`excluded.duration`,
        radiant_win: sql`excluded.radiant_win`,
        game_mode: sql`excluded.game_mode`,
        lobby_type: sql`excluded.lobby_type`,
        average_rank: sql`excluded.average_rank`,
        radiant_score: sql`excluded.radiant_score`,
        dire_score: sql`excluded.dire_score`,
      },
    });

  const playerRows = data.players
    .filter(
      (player): player is typeof player & { account_id: number } => player.account_id !== null,
    )
    .map((player) => ({
      match_id: data.match_id,
      account_id: player.account_id,
      hero_id: player.hero_id,
      is_radiant: player.player_slot < 128,
      player_slot: player.player_slot,
      kills: player.kills,
      deaths: player.deaths,
      assists: player.assists,
      gpm: player.gold_per_min,
      xpm: player.xp_per_min,
      last_hits: player.last_hits,
      hero_damage: player.hero_damage,
      hero_healing: player.hero_healing,
      mmr_before: null,
      mmr_after: null,
      mmr_delta: null,
      mmr_source: null,
    }));

  if (playerRows.length > 0) {
    await db
      .insert(matchPlayers)
      .values(playerRows)
      .onConflictDoUpdate({
        target: [matchPlayers.match_id, matchPlayers.account_id],
        set: {
          hero_id: sql`excluded.hero_id`,
          is_radiant: sql`excluded.is_radiant`,
          player_slot: sql`excluded.player_slot`,
          kills: sql`excluded.kills`,
          deaths: sql`excluded.deaths`,
          assists: sql`excluded.assists`,
          gpm: sql`excluded.gpm`,
          xpm: sql`excluded.xpm`,
          last_hits: sql`excluded.last_hits`,
          hero_damage: sql`excluded.hero_damage`,
          hero_healing: sql`excluded.hero_healing`,
        },
      });
  }

  return {
    matchId: data.match_id,
    storedPlayers: playerRows.length,
    skippedPlayers: data.players.length - playerRows.length,
  };
}

/**
 * Sync match milik seorang pemain, inkremental.
 *
 * Hanya match yang belum ada di `match_players` milik pemain ini yang diambil
 * detailnya, sehingga pemanggilan berulang tidak menghabiskan kuota OpenDota.
 */
export async function syncPlayerMatches(
  accountId: number,
  options: { limit?: number } = {},
): Promise<{ checked: number; alreadyStored: number; synced: number }> {
  return withSyncLog('matches', accountId, async () => {
    const recent = await getOpenDotaClient().getPlayerRecentMatches(accountId);

    const known = new Set(
      (
        await db
          .select({ match_id: matchPlayers.match_id })
          .from(matchPlayers)
          .where(eq(matchPlayers.account_id, accountId))
      ).map((row) => row.match_id),
    );

    const missing = recent.filter((match) => !known.has(match.match_id));
    const toSync = missing.slice(0, options.limit ?? missing.length);

    for (const match of toSync) {
      await syncMatchDetail(match.match_id);
    }

    logger.debug('sync matches', {
      accountId,
      checked: recent.length,
      alreadyStored: recent.length - missing.length,
      synced: toSync.length,
      at: epochNow(),
    });

    return {
      checked: recent.length,
      alreadyStored: recent.length - missing.length,
      synced: toSync.length,
    };
  });
}
