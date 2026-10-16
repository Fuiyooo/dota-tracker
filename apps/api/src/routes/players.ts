import {
  accountIdParamSchema,
  accountIdToSteamId64,
  paginationQuerySchema,
  playerSearchQuerySchema,
  rankTierLabel,
} from '@dota/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { getOpenDotaClient } from '../opendota/client.js';

function badRequest(reply: FastifyReply, error: string, issues?: unknown) {
  return reply.code(400).send({ error, issues });
}

/** account_id bisa di luar rentang SteamID64; jangan sampai melempar. */
function safeSteamId64(accountId: number): string | null {
  try {
    return accountIdToSteamId64(accountId);
  } catch {
    return null;
  }
}

export async function playersRoutes(app: FastifyInstance): Promise<void> {
  const opendota = getOpenDotaClient();

  // Didaftarkan sebelum /players/:accountId supaya "search" tidak dibaca sebagai account_id.
  app.get('/players/search', async (request, reply) => {
    const parsed = playerSearchQuerySchema.safeParse(request.query);
    if (!parsed.success) return badRequest(reply, 'Parameter q tidak valid', parsed.error.issues);

    const results = await opendota.searchPlayers(parsed.data.q);
    return results.slice(0, 20);
  });

  app.get('/players/:accountId', async (request, reply) => {
    const parsed = accountIdParamSchema.safeParse(request.params);
    if (!parsed.success) return badRequest(reply, 'accountId tidak valid', parsed.error.issues);

    const player = await opendota.getPlayer(parsed.data.accountId);
    if (player.profile === null) {
      return reply.code(404).send({ error: `Akun ${parsed.data.accountId} tidak ditemukan` });
    }

    return {
      account_id: player.profile.account_id,
      steam_id64: player.profile.steamid ?? safeSteamId64(player.profile.account_id),
      personaname: player.profile.personaname,
      avatar: player.profile.avatarfull ?? player.profile.avatar,
      rank_tier: player.rank_tier,
      leaderboard_rank: player.leaderboard_rank,
      computed_mmr: player.computed_mmr,
      rank_label: rankTierLabel(player.rank_tier, player.leaderboard_rank),
    };
  });

  app.get('/players/:accountId/matches', async (request, reply) => {
    const params = accountIdParamSchema.safeParse(request.params);
    if (!params.success) return badRequest(reply, 'accountId tidak valid', params.error.issues);

    const query = paginationQuerySchema.safeParse(request.query);
    if (!query.success) return badRequest(reply, 'limit/offset tidak valid', query.error.issues);

    const all = await opendota.getPlayerRecentMatches(params.data.accountId);
    const { limit, offset } = query.data;

    return all.slice(offset, offset + limit).map((match) => {
      // Konvensi OpenDota: player_slot < 128 berarti tim Radiant.
      const isRadiant = match.player_slot < 128;
      return {
        match_id: match.match_id,
        hero_id: match.hero_id,
        start_time: match.start_time,
        duration: match.duration,
        lobby_type: match.lobby_type,
        game_mode: match.game_mode,
        player_slot: match.player_slot,
        is_radiant: isRadiant,
        won: isRadiant === match.radiant_win,
        kills: match.kills,
        deaths: match.deaths,
        assists: match.assists,
        gold_per_min: match.gold_per_min,
        xp_per_min: match.xp_per_min,
        last_hits: match.last_hits,
        hero_damage: match.hero_damage,
        hero_healing: match.hero_healing,
        party_size: match.party_size,
        average_rank: match.average_rank,
      };
    });
  });
}
