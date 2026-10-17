import { describeMatchMode, matchIdParamSchema } from '@dota/shared';
import type { FastifyInstance } from 'fastify';
import { getOpenDotaClient } from '../opendota/client.js';
import { badRequest } from './helpers.js';

export async function matchesRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Detail satu match, diambil live dari OpenDota.
   *
   * Sengaja tidak membaca database: `match_players` melewatkan pemain berprofil
   * privat (account_id NULL), sedangkan `/matches/{id}` tetap memberi statistik
   * mereka. Cache client untuk detail match bersifat PERMANEN (Bagian 4), jadi
   * membuka match yang sama berulang kali tidak memakai kuota lagi.
   */
  app.get('/matches/:matchId', async (request, reply) => {
    const parsed = matchIdParamSchema.safeParse(request.params);
    if (!parsed.success) return badRequest(reply, 'Invalid matchId', parsed.error.issues);

    const match = await getOpenDotaClient().getMatch(parsed.data.matchId);

    // `/matches/{id}` tidak punya average_rank di level atas; hitung dari pemain.
    const ranks = match.players
      .map((player) => player.rank_tier)
      .filter((rank): rank is number => rank !== null && rank > 0);
    const averageRank =
      ranks.length > 0
        ? Math.round(ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length)
        : null;

    return {
      match_id: match.match_id,
      start_time: match.start_time,
      duration: match.duration,
      radiant_win: match.radiant_win,
      lobby_type: match.lobby_type,
      game_mode: match.game_mode,
      mode: describeMatchMode(match.lobby_type, match.game_mode).detail,
      radiant_score: match.radiant_score,
      dire_score: match.dire_score,
      average_rank: averageRank,
      players: match.players
        .map((player) => ({
          player_slot: player.player_slot,
          account_id: player.account_id,
          personaname: player.personaname,
          hero_id: player.hero_id,
          is_radiant: player.player_slot < 128,
          kills: player.kills,
          deaths: player.deaths,
          assists: player.assists,
          gold_per_min: player.gold_per_min,
          xp_per_min: player.xp_per_min,
          last_hits: player.last_hits,
          denies: player.denies,
          net_worth: player.net_worth,
          level: player.level,
          hero_damage: player.hero_damage,
          hero_healing: player.hero_healing,
        }))
        .sort((a, b) => a.player_slot - b.player_slot),
      source: 'opendota',
    };
  });
}
