import { z } from 'zod';

/**
 * Bentuk respons MENTAH dari OpenDota. Hanya field yang kita pakai yang
 * dideklarasikan; field lain dibuang oleh zod.
 *
 * Field yang secara nyata tidak selalu ada (mis. pada match yang belum
 * di-parse) diberi `.default(null)` supaya tidak menggagalkan seluruh respons.
 */

export const openDotaProfileSchema = z.object({
  account_id: z.number().int(),
  personaname: z.string().nullable().default(null),
  steamid: z.string().nullable().default(null),
  avatar: z.string().nullable().default(null),
  avatarfull: z.string().nullable().default(null),
  profileurl: z.string().nullable().default(null),
  last_login: z.string().nullable().default(null),
});
export type OpenDotaProfile = z.infer<typeof openDotaProfileSchema>;

/** GET /players/{account_id} */
export const openDotaPlayerSchema = z.object({
  profile: openDotaProfileSchema.nullable().default(null),
  rank_tier: z.number().int().nullable().default(null),
  leaderboard_rank: z.number().int().nullable().default(null),
  // desimal, mis. 3935.88
  computed_mmr: z.number().nullable().default(null),
});
export type OpenDotaPlayer = z.infer<typeof openDotaPlayerSchema>;

/** GET /search?q= */
export const openDotaSearchResultSchema = z.object({
  account_id: z.number().int(),
  personaname: z.string().nullable().default(null),
  avatarfull: z.string().nullable().default(null),
  last_match_time: z.string().nullable().default(null),
});
export type OpenDotaSearchResult = z.infer<typeof openDotaSearchResultSchema>;

/** GET /players/{id}/matches - TIDAK memuat gpm/xpm/hero_damage */
export const openDotaPlayerMatchSchema = z.object({
  match_id: z.number().int(),
  player_slot: z.number().int(),
  radiant_win: z.boolean(),
  duration: z.number().int(),
  game_mode: z.number().int(),
  lobby_type: z.number().int(),
  hero_id: z.number().int(),
  start_time: z.number().int(),
  kills: z.number().int(),
  deaths: z.number().int(),
  assists: z.number().int(),
  average_rank: z.number().int().nullable().default(null),
  party_size: z.number().int().nullable().default(null),
});
export type OpenDotaPlayerMatch = z.infer<typeof openDotaPlayerMatchSchema>;

/** GET /players/{id}/recentMatches - di sini gpm/xpm/hero_damage ada */
export const openDotaRecentMatchSchema = openDotaPlayerMatchSchema.extend({
  gold_per_min: z.number().int(),
  xp_per_min: z.number().int(),
  last_hits: z.number().int(),
  hero_damage: z.number().int(),
  hero_healing: z.number().int(),
});
export type OpenDotaRecentMatch = z.infer<typeof openDotaRecentMatchSchema>;

/** GET /players/{id}/heroes - perhatikan namanya `win`, bukan `wins` */
export const openDotaPlayerHeroSchema = z.object({
  hero_id: z.number().int(),
  last_played: z.number().int().nullable().default(null),
  games: z.number().int(),
  win: z.number().int(),
  with_games: z.number().int().default(0),
  with_win: z.number().int().default(0),
  against_games: z.number().int().default(0),
  against_win: z.number().int().default(0),
});
export type OpenDotaPlayerHero = z.infer<typeof openDotaPlayerHeroSchema>;

/** GET /players/{id}/wl */
export const openDotaWinLossSchema = z.object({
  win: z.number().int().default(0),
  lose: z.number().int().default(0),
});
export type OpenDotaWinLoss = z.infer<typeof openDotaWinLossSchema>;

/** GET /matches/{match_id} - TIDAK ada `average_rank` di level atas */
export const openDotaMatchPlayerSchema = z.object({
  // Bisa kosong untuk pemain dengan profil privat / tanpa public match data.
  account_id: z.number().int().nullable().default(null),
  player_slot: z.number().int(),
  hero_id: z.number().int(),
  isRadiant: z.boolean(),
  kills: z.number().int(),
  deaths: z.number().int(),
  assists: z.number().int(),
  gold_per_min: z.number().int(),
  xp_per_min: z.number().int(),
  last_hits: z.number().int(),
  hero_damage: z.number().int(),
  hero_healing: z.number().int(),
  rank_tier: z.number().int().nullable().default(null),
});
export type OpenDotaMatchPlayer = z.infer<typeof openDotaMatchPlayerSchema>;

export const openDotaMatchSchema = z.object({
  match_id: z.number().int(),
  start_time: z.number().int(),
  duration: z.number().int(),
  radiant_win: z.boolean(),
  game_mode: z.number().int(),
  lobby_type: z.number().int(),
  radiant_score: z.number().int().nullable().default(null),
  dire_score: z.number().int().nullable().default(null),
  players: z.array(openDotaMatchPlayerSchema).default([]),
});
export type OpenDotaMatch = z.infer<typeof openDotaMatchSchema>;

/** GET /heroStats */
export const openDotaHeroStatSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  localized_name: z.string(),
  img: z.string(),
  icon: z.string().default(''),
  primary_attr: z.string(),
  roles: z.array(z.string()).default([]),
});
export type OpenDotaHeroStat = z.infer<typeof openDotaHeroStatSchema>;
