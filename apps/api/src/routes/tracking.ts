import {
  accountIdParamSchema,
  trackPlayerBodySchema,
  trackingToggleBodySchema,
} from '@dota/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { players } from '../db/schema.js';
import { getOpenDotaClient, OpenDotaError } from '../opendota/client.js';
import { findPlayerRow, listRecentSyncLogs, listTrackedPlayers } from '../queries/players.js';
import { syncPlayer, syncPlayerMatches, syncPlayerProfile } from '../sync/index.js';
import { badRequest } from './helpers.js';
import { resolveDirect } from './players.js';

export async function trackingRoutes(app: FastifyInstance): Promise<void> {
  /** Mulai tracking: resolusi query -> upsert profil -> sync match awal. */
  app.post('/players', async (request, reply) => {
    const parsed = trackPlayerBodySchema.safeParse(request.body);
    if (!parsed.success) return badRequest(reply, 'Invalid body', parsed.error.issues);

    const direct = await resolveDirect(parsed.data.query);
    if (direct === null) {
      return reply.code(400).send({
        error:
          'To start tracking, send an account_id, SteamID64, or Steam vanity URL. To search by name, use GET /api/players/search first.',
      });
    }

    const { accountId } = direct;

    try {
      await syncPlayerProfile(accountId);
    } catch (error) {
      // Kata biasa bisa terdaftar sebagai vanity Steam yang akunnya tidak punya
      // profil OpenDota. Beri arahan alih-alih pesan 404 yang membingungkan.
      if (error instanceof OpenDotaError && error.status === 404) {
        return reply.code(404).send({
          error: `No OpenDota profile for account ${accountId} (resolved from "${parsed.data.query}" as ${direct.resolvedFrom}). To search by name, use GET /api/players/search first.`,
        });
      }
      throw error;
    }

    const trackingEnabled = parsed.data.tracking_enabled ?? true;
    await db
      .update(players)
      .set({ tracking_enabled: trackingEnabled })
      .where(eq(players.account_id, accountId));

    // `match_limit: 0` melewati sync match, berguna kalau ingin respons cepat.
    const matchLimit = parsed.data.match_limit ?? 20;
    const matches =
      matchLimit > 0 ? await syncPlayerMatches(accountId, { limit: matchLimit }) : null;

    const stored = await findPlayerRow(accountId);

    return reply.code(201).send({
      player: stored,
      resolved_from: direct.resolvedFrom,
      tracking_enabled: trackingEnabled,
      matches,
    });
  });

  app.post('/players/:accountId/sync', async (request, reply) => {
    const parsed = accountIdParamSchema.safeParse(request.params);
    if (!parsed.success) return badRequest(reply, 'Invalid accountId', parsed.error.issues);

    const result = await syncPlayer(parsed.data.accountId, { matchLimit: 20 });

    return {
      account_id: result.profile.account_id,
      personaname: result.profile.personaname,
      rank_tier: result.profile.rank_tier,
      computed_mmr: result.profile.computed_mmr,
      matches: result.matches,
    };
  });

  /** Nyalakan/matikan tracking. Mengaktifkan ulang juga mereset backoff. */
  app.patch('/players/:accountId/tracking', async (request, reply) => {
    const params = accountIdParamSchema.safeParse(request.params);
    if (!params.success) return badRequest(reply, 'Invalid accountId', params.error.issues);

    const body = trackingToggleBodySchema.safeParse(request.body);
    if (!body.success) return badRequest(reply, 'Invalid body', body.error.issues);

    const updated = await db
      .update(players)
      .set({
        tracking_enabled: body.data.enabled,
        sync_failures: 0,
        next_sync_at: null,
      })
      .where(eq(players.account_id, params.data.accountId))
      .returning({
        account_id: players.account_id,
        tracking_enabled: players.tracking_enabled,
        sync_failures: players.sync_failures,
        next_sync_at: players.next_sync_at,
      });

    const row = updated[0];
    if (row === undefined) {
      return reply.code(404).send({
        error: `Player ${params.data.accountId} is not tracked yet. Use POST /api/players first.`,
      });
    }

    return row;
  });

  app.get('/sync/status', async () => {
    const opendota = getOpenDotaClient();
    const [trackedPlayers, recentLogs] = await Promise.all([
      listTrackedPlayers(),
      listRecentSyncLogs(20),
    ]);

    return {
      opendota: opendota.dailyUsage,
      cacheSize: opendota.cacheSize,
      tracked_players: trackedPlayers,
      recent_logs: recentLogs,
    };
  });
}
