import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { heroes, matches, matchPlayers, players, syncLogs } from '../db/schema.js';

/** Ekspresi SQL bersama: apakah pemain ini menang pada match tersebut. */
const wonExpression = sql<boolean>`((${matchPlayers.is_radiant} and ${matches.radiant_win}) or (not ${matchPlayers.is_radiant} and not ${matches.radiant_win}))`;

export async function findPlayerRow(accountId: number) {
  const rows = await db.select().from(players).where(eq(players.account_id, accountId)).limit(1);
  return rows[0] ?? null;
}

export async function listTrackedPlayers() {
  return db
    .select({
      account_id: players.account_id,
      personaname: players.personaname,
      avatar: players.avatar,
      rank_tier: players.rank_tier,
      computed_mmr: players.computed_mmr,
      tracking_enabled: players.tracking_enabled,
      sync_failures: players.sync_failures,
      next_sync_at: players.next_sync_at,
      last_synced_at: players.last_synced_at,
    })
    .from(players)
    .where(eq(players.tracking_enabled, true))
    .orderBy(desc(players.last_synced_at));
}

export interface PlayerHeroStat {
  hero_id: number;
  localized_name: string | null;
  img: string | null;
  games: number;
  wins: number;
  winrate: number;
}

/** Winrate per hero, dihitung dari `match_players` yang sudah tersinkron. */
export async function listPlayerHeroStats(accountId: number): Promise<PlayerHeroStat[]> {
  const rows = await db
    .select({
      hero_id: matchPlayers.hero_id,
      games: sql<number>`count(*)::int`,
      wins: sql<number>`count(*) filter (where ${wonExpression})::int`,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.match_id, matchPlayers.match_id))
    .where(eq(matchPlayers.account_id, accountId))
    .groupBy(matchPlayers.hero_id);

  const heroRows = await db
    .select({ hero_id: heroes.hero_id, localized_name: heroes.localized_name, img: heroes.img })
    .from(heroes);
  const heroById = new Map(heroRows.map((hero) => [hero.hero_id, hero]));

  return rows
    .map((row) => ({
      hero_id: row.hero_id,
      localized_name: heroById.get(row.hero_id)?.localized_name ?? null,
      img: heroById.get(row.hero_id)?.img ?? null,
      games: row.games,
      wins: row.wins,
      winrate: row.games > 0 ? Number((row.wins / row.games).toFixed(4)) : 0,
    }))
    .sort((a, b) => b.games - a.games || a.hero_id - b.hero_id);
}

export interface PlayerSummary {
  account_id: number;
  synced_matches: number;
  wins: number;
  losses: number;
  winrate: number;
  current_streak: { type: 'win' | 'loss'; length: number } | null;
  top_heroes: PlayerHeroStat[];
}

/**
 * Ringkasan PEMBATAS: hanya menghitung match yang sudah ada di database
 * (hasil sync), bukan seluruh riwayat pemain. Hitungan seumur hidup
 * disediakan terpisah oleh endpoint lewat OpenDota `/wl`.
 */
export async function getPlayerSummary(accountId: number): Promise<PlayerSummary> {
  const rows = await db
    .select({
      match_id: matchPlayers.match_id,
      start_time: matches.start_time,
      won: wonExpression,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.match_id, matchPlayers.match_id))
    .where(eq(matchPlayers.account_id, accountId))
    .orderBy(desc(matches.start_time));

  let wins = 0;
  let losses = 0;
  for (const row of rows) {
    if (row.won) wins += 1;
    else losses += 1;
  }

  // Streak dihitung terpisah supaya `wins`/`losses` tetap mencakup SEMUA baris.
  let currentStreak: { type: 'win' | 'loss'; length: number } | null = null;
  for (const row of rows) {
    const type = row.won ? 'win' : 'loss';
    if (currentStreak === null) {
      currentStreak = { type, length: 1 };
    } else if (currentStreak.type === type) {
      currentStreak.length += 1;
    } else {
      break;
    }
  }

  const heroStats = await listPlayerHeroStats(accountId);

  return {
    account_id: accountId,
    synced_matches: rows.length,
    wins,
    losses,
    winrate: rows.length > 0 ? Number((wins / rows.length).toFixed(4)) : 0,
    current_streak: currentStreak,
    top_heroes: heroStats.slice(0, 5),
  };
}

export interface StoredMatch {
  match_id: number;
  hero_id: number;
  start_time: number;
  duration: number;
  lobby_type: number;
  game_mode: number;
  player_slot: number;
  is_radiant: boolean;
  won: boolean;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_min: number;
  xp_per_min: number;
  last_hits: number;
  hero_damage: number;
  hero_healing: number;
  average_rank: number | null;
}

/** Match tersimpan (hasil sync), dipakai agar endpoint tidak selalu memanggil OpenDota. */
export async function listStoredMatches(
  accountId: number,
  limit: number,
  offset: number,
): Promise<StoredMatch[]> {
  return db
    .select({
      match_id: matchPlayers.match_id,
      hero_id: matchPlayers.hero_id,
      start_time: matches.start_time,
      duration: matches.duration,
      lobby_type: matches.lobby_type,
      game_mode: matches.game_mode,
      player_slot: matchPlayers.player_slot,
      is_radiant: matchPlayers.is_radiant,
      won: wonExpression,
      kills: matchPlayers.kills,
      deaths: matchPlayers.deaths,
      assists: matchPlayers.assists,
      gold_per_min: matchPlayers.gpm,
      xp_per_min: matchPlayers.xpm,
      last_hits: matchPlayers.last_hits,
      hero_damage: matchPlayers.hero_damage,
      hero_healing: matchPlayers.hero_healing,
      average_rank: matches.average_rank,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.match_id, matchPlayers.match_id))
    .where(eq(matchPlayers.account_id, accountId))
    .orderBy(desc(matches.start_time))
    .limit(limit)
    .offset(offset);
}

export async function listRecentSyncLogs(limit = 20) {
  return db.select().from(syncLogs).orderBy(desc(syncLogs.id)).limit(limit);
}
