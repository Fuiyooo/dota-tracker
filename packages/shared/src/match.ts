import { z } from 'zod';
import { mmrSourceSchema } from './mmr.js';

export const matchSchema = z.object({
  match_id: z.number().int().positive(),
  start_time: z.number().int(), // epoch detik (UTC)
  duration: z.number().int().nonnegative(),
  radiant_win: z.boolean(),
  game_mode: z.number().int(),
  lobby_type: z.number().int(),
  average_rank: z.number().int().nullable(),
  radiant_score: z.number().int().nullable(),
  dire_score: z.number().int().nullable(),
});
export type Match = z.infer<typeof matchSchema>;

export const matchPlayerSchema = z.object({
  match_id: z.number().int().positive(),
  account_id: z.number().int().positive(),
  hero_id: z.number().int().positive(),
  is_radiant: z.boolean(),
  player_slot: z.number().int(),
  kills: z.number().int().nonnegative(),
  deaths: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  gpm: z.number().int().nonnegative(),
  xpm: z.number().int().nonnegative(),
  last_hits: z.number().int().nonnegative(),
  hero_damage: z.number().int().nonnegative(),
  hero_healing: z.number().int().nonnegative(),
  mmr_before: z.number().int().nullable(),
  mmr_after: z.number().int().nullable(),
  mmr_delta: z.number().int().nullable(),
  mmr_source: mmrSourceSchema.nullable(),
});
export type MatchPlayer = z.infer<typeof matchPlayerSchema>;
