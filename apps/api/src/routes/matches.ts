import { describeMatchMode, matchIdParamSchema } from '@dota/shared';
import type { FastifyInstance } from 'fastify';
import { logger } from '../logger.js';
import { getOpenDotaClient } from '../opendota/client.js';
import { badRequest } from './helpers.js';

interface ItemRef {
  id: number;
  /** Nama internal, mis. `blink`. */
  name: string;
  /** Nama tampilan, mis. `Blink Dagger`. */
  dname: string | null;
  img: string | null;
  cost: number | null;
}

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

    const opendota = getOpenDotaClient();
    const match = await opendota.getMatch(parsed.data.matchId);

    // Konstanta item (~344 KB) di-cache 24 jam. Kalau gagal, halaman detail
    // tetap tampil tanpa ikon item - jangan sampai 500.
    const itemConstants = await opendota.getItemConstants().catch((error: unknown) => {
      logger.warn('gagal mengambil konstanta item', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    });

    const itemById = new Map<number, ItemRef>();
    for (const [name, item] of Object.entries(itemConstants)) {
      itemById.set(item.id, {
        id: item.id,
        name,
        dname: item.dname,
        img: item.img,
        cost: item.cost,
      });
    }

    /** Slot 0 / null berarti kosong. */
    const resolveItems = (slots: Array<number | null>): ItemRef[] =>
      slots
        .map((id) => (id === null || id <= 0 ? null : (itemById.get(id) ?? null)))
        .filter((item): item is ItemRef => item !== null);

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
      /** Urutan pick. Kosong untuk mode tanpa draft. */
      picks: match.picks_bans
        .filter((entry) => entry.is_pick)
        .sort((a, b) => a.order - b.order)
        .map((entry) => ({ order: entry.order, team: entry.team, hero_id: entry.hero_id })),
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
          items: resolveItems([
            player.item_0,
            player.item_1,
            player.item_2,
            player.item_3,
            player.item_4,
            player.item_5,
          ]),
          backpack: resolveItems([player.backpack_0, player.backpack_1, player.backpack_2]),
          neutral: resolveItems([player.item_neutral])[0] ?? null,
        }))
        .sort((a, b) => a.player_slot - b.player_slot),
      source: 'opendota',
    };
  });
}
