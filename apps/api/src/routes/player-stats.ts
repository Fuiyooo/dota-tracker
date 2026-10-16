import { accountIdParamSchema, paginationQuerySchema, rankTierLabel } from '@dota/shared';
import type { FastifyInstance } from 'fastify';
import { getOpenDotaClient } from '../opendota/client.js';
import { listMmrHistory } from '../queries/mmr.js';
import { findPlayerRow, getPlayerSummary, listPlayerHeroStats } from '../queries/players.js';
import { badRequest } from './helpers.js';

export async function playerStatsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/players/:accountId/heroes', async (request, reply) => {
    const parsed = accountIdParamSchema.safeParse(request.params);
    if (!parsed.success) return badRequest(reply, 'Invalid accountId', parsed.error.issues);

    const heroStats = await listPlayerHeroStats(parsed.data.accountId);
    return {
      account_id: parsed.data.accountId,
      synced_matches: heroStats.reduce((total, hero) => total + hero.games, 0),
      heroes: heroStats,
      source: 'database',
    };
  });

  app.get('/players/:accountId/summary', async (request, reply) => {
    const parsed = accountIdParamSchema.safeParse(request.params);
    if (!parsed.success) return badRequest(reply, 'Invalid accountId', parsed.error.issues);
    const { accountId } = parsed.data;

    const stored = await findPlayerRow(accountId);
    const summary = await getPlayerSummary(accountId);

    // Total seumur hidup hanya OpenDota yang punya. Kegagalannya TIDAK boleh
    // menggagalkan ringkasan yang sudah bisa dihitung dari database.
    let lifetime: { win: number; lose: number } | null = null;
    try {
      lifetime = await getOpenDotaClient().getPlayerWinLoss(accountId);
    } catch {
      lifetime = null;
    }

    const rankTier = stored?.rank_tier ?? null;
    const leaderboardRank = stored?.leaderboard_rank ?? null;

    return {
      account_id: accountId,
      rank_tier: rankTier,
      leaderboard_rank: leaderboardRank,
      rank_label: rankTierLabel(rankTier, leaderboardRank),
      computed_mmr: stored?.computed_mmr ?? null,
      /** Dihitung HANYA dari match yang sudah tersinkron. */
      synced: summary,
      /** Total seumur hidup dari OpenDota; null bila OpenDota tidak bisa dihubungi. */
      lifetime,
    };
  });

  app.get('/players/:accountId/mmr-history', async (request, reply) => {
    const params = accountIdParamSchema.safeParse(request.params);
    if (!params.success) return badRequest(reply, 'Invalid accountId', params.error.issues);

    const query = paginationQuerySchema.safeParse(request.query);
    if (!query.success) return badRequest(reply, 'Invalid limit/offset', query.error.issues);

    const entries = await listMmrHistory(params.data.accountId, query.data.limit);
    return { account_id: params.data.accountId, entries, source: 'database' };
  });
}
