import { z } from 'zod';

export const playerSchema = z.object({
  account_id: z.number().int().positive(),
  steam_id64: z.string().regex(/^\d{17}$/),
  personaname: z.string().nullable(),
  avatar: z.string().nullable(),
  rank_tier: z.number().int().nullable(),
  leaderboard_rank: z.number().int().nullable(),
  computed_mmr: z.number().int().nullable(),
  tracking_enabled: z.boolean(),
  last_synced_at: z.number().int().nullable(), // epoch detik (UTC)
});
export type Player = z.infer<typeof playerSchema>;
