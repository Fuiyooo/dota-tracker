import {
  accountIdParamSchema,
  paginationQuerySchema,
  parseSteamIdInput,
  playerSearchQuerySchema,
  rankTierLabel,
} from '@dota/shared';
import type { FastifyInstance } from 'fastify';
import { getOpenDotaClient } from '../opendota/client.js';
import { logger } from '../logger.js';
import { findPlayerRow, listStoredMatches } from '../queries/players.js';
import { getSteamClient } from '../steam/client.js';
import { badRequest, safeSteamId64 } from './helpers.js';

/** Hasil resolusi langsung: input sudah menunjuk akun tertentu, tanpa perlu dicari. */
async function resolveDirect(
  query: string,
): Promise<{ accountId: number; resolvedFrom: string } | null> {
  const parsed = parseSteamIdInput(query);

  if (parsed.kind === 'accountId')
    return { accountId: parsed.accountId, resolvedFrom: 'account_id' };
  if (parsed.kind === 'steamId64')
    return { accountId: parsed.accountId, resolvedFrom: 'steamid64' };

  if (parsed.kind === 'vanity') {
    const accountId = await getSteamClient().resolveVanityUrl(parsed.vanity);
    if (accountId !== null) return { accountId, resolvedFrom: 'vanity' };
  }

  return null;
}

export async function playersRoutes(app: FastifyInstance): Promise<void> {
  // Client diambil per-permintaan (bukan saat registrasi) supaya bisa diganti
  // di tes tanpa bergantung pada urutan inisialisasi.
  // Didaftarkan sebelum /players/:accountId supaya "search" tidak dibaca sebagai account_id.
  app.get('/players/search', async (request, reply) => {
    const parsed = playerSearchQuerySchema.safeParse(request.query);
    if (!parsed.success) return badRequest(reply, 'Invalid "q" parameter', parsed.error.issues);

    const query = parsed.data.q;

    // 1. Input yang sudah menunjuk akun (account_id / steamid64 / vanity).
    const direct = await resolveDirect(query);
    if (direct !== null) {
      try {
        const player = await getOpenDotaClient().getPlayer(direct.accountId);
        const profile = player.profile;
        return [
          {
            account_id: direct.accountId,
            personaname: profile?.personaname ?? null,
            avatarfull: profile?.avatarfull ?? profile?.avatar ?? null,
            last_match_time: null,
            rank_tier: player.rank_tier,
            resolved_from: direct.resolvedFrom,
          },
        ];
      } catch (error) {
        // Kata biasa bisa kebetulan terdaftar sebagai vanity Steam yang akunnya
        // tidak dikenal OpenDota (mis. "nyen"). Jangan gagalkan pencarian —
        // lanjutkan ke pencarian nama. Sebaliknya, account_id/steamid64 yang
        // tidak ada memang harus menjadi error.
        if (direct.resolvedFrom !== 'vanity') throw error;
        logger.debug('search: vanity menunjuk akun tanpa profil OpenDota, lanjut cari nama', {
          vanity: query,
          accountId: direct.accountId,
        });
      }
    }

    // 2. Selain itu, cari berdasarkan nama lewat OpenDota.
    const results = await getOpenDotaClient().searchPlayers(query);
    return results.slice(0, 20).map((result) => ({ ...result, resolved_from: 'name' }));
  });

  app.get('/players/:accountId', async (request, reply) => {
    const parsed = accountIdParamSchema.safeParse(request.params);
    if (!parsed.success) return badRequest(reply, 'Invalid accountId', parsed.error.issues);
    const { accountId } = parsed.data;

    // Database lebih dulu: tanpa kuota, dan tetap jalan saat OpenDota dibatasi.
    const stored = await findPlayerRow(accountId);
    if (stored !== null) {
      return {
        account_id: stored.account_id,
        steam_id64: stored.steam_id64,
        personaname: stored.personaname,
        avatar: stored.avatar,
        rank_tier: stored.rank_tier,
        leaderboard_rank: stored.leaderboard_rank,
        computed_mmr: stored.computed_mmr,
        rank_label: rankTierLabel(stored.rank_tier, stored.leaderboard_rank),
        tracking_enabled: stored.tracking_enabled,
        last_synced_at: stored.last_synced_at,
        source: 'database',
      };
    }

    const player = await getOpenDotaClient().getPlayer(accountId);
    if (player.profile === null) {
      return reply.code(404).send({ error: `Player ${accountId} not found` });
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
      tracking_enabled: false,
      last_synced_at: null,
      source: 'opendota',
    };
  });

  app.get('/players/:accountId/matches', async (request, reply) => {
    const params = accountIdParamSchema.safeParse(request.params);
    if (!params.success) return badRequest(reply, 'Invalid accountId', params.error.issues);

    const query = paginationQuerySchema.safeParse(request.query);
    if (!query.success) return badRequest(reply, 'Invalid limit/offset', query.error.issues);

    const { accountId } = params.data;
    const { limit, offset } = query.data;

    const stored = await listStoredMatches(accountId, limit, offset);
    if (stored.length > 0) {
      // Bentuk respons sengaja disamakan dengan jalur OpenDota di bawah supaya
      // konsumen tidak perlu tahu dari mana datanya berasal.
      return stored.map((match) => ({ ...match, party_size: null, source: 'database' }));
    }

    const live = await getOpenDotaClient().getPlayerRecentMatches(accountId);
    return live.slice(offset, offset + limit).map((match) => {
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
        source: 'opendota',
      };
    });
  });
}

export { resolveDirect };
