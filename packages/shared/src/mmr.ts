import { z } from 'zod';

/**
 * MMR resmi per match tidak tersedia dari Valve. Angka MMR di sini berasal dari
 * STRATZ (`stratz`) atau hasil estimasi dari snapshot profil (`estimate`).
 */
export const mmrSourceSchema = z.enum(['stratz', 'estimate']);
export type MmrSource = z.infer<typeof mmrSourceSchema>;

export const mmrSnapshotSchema = z.object({
  id: z.number().int(),
  account_id: z.number().int().positive(),
  recorded_at: z.number().int(), // epoch detik (UTC)
  rank_tier: z.number().int().nullable(),
  leaderboard_rank: z.number().int().nullable(),
  computed_mmr: z.number().int().nullable(),
  source: mmrSourceSchema,
});
export type MmrSnapshot = z.infer<typeof mmrSnapshotSchema>;
