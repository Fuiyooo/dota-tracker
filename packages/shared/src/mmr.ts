import { z } from 'zod';

/**
 * MMR resmi per match tidak tersedia dari Valve, dan **juga tidak dari STRATZ**.
 *
 * Hasil verifikasi schema STRATZ (Bagian 5): `MatchPlayerType` punya 55 field
 * dan tidak satu pun menyangkut MMR — `mmrBefore`/`mmrAfter`/`mmrDelta` tidak
 * ada. Satu-satunya field bernuansa MMR di seluruh schema STRATZ adalah
 * `PlayerPerformanceType.mmrTier` / `mmrBracket`, dan itu tingkat/bracket,
 * bukan nilai MMR.
 *
 * Yang STRATZ sediakan hanyalah histori RANK (`player.ranks`), bukan MMR.
 * Karena itu angka MMR selalu berupa `estimate` (snapshot profil, Bagian 7),
 * dan `stratz` hanya terpakai bila kelak ada sumber MMR yang benar-benar ada.
 */
export const mmrSourceSchema = z.enum(['stratz', 'estimate']);
export type MmrSource = z.infer<typeof mmrSourceSchema>;

export const mmrSnapshotSchema = z.object({
  id: z.number().int(),
  account_id: z.number().int().positive(),
  recorded_at: z.number().int(), // epoch detik (UTC)
  rank_tier: z.number().int().nullable(),
  leaderboard_rank: z.number().int().nullable(),
  computed_mmr: z.number().nullable(), // desimal, mis. 3960.07 (bukan integer)
  source: mmrSourceSchema,
});
export type MmrSnapshot = z.infer<typeof mmrSnapshotSchema>;
