import { z } from 'zod';

/**
 * Bentuk respons MENTAH STRATZ. Hanya field yang kita pakai yang dideklarasikan.
 *
 * Hasil verifikasi schema (Bagian 5, 16 Okt 2026):
 * - Root query type bernama `DotaQuery`.
 * - `player(steamAccountId: Long) -> PlayerType`
 * - `match(id: Long) -> MatchType`
 *
 * Yang TERSEDIA dan kita pakai:
 * - `PlayerType.ranks` -> `[SteamAccountSeasonRankType]` berupa DERET WAKTU
 *   (`seasonRankId`, `rank`, `isCore`, `asOfDateTime`) - histori rank, bukan
 *   snapshot tunggal.
 * - `PlayerType.leaderboardRanks` -> `[SteamAccountSeasonLeaderBoardRankType]`
 * - `PlayerType.matchCount`
 * - `MatchType.rank` / `MatchType.actualRank` -> terisi (mis. 44)
 * - `MatchType.averageRank` -> SERING NULL, jangan diandalkan
 *
 * Yang TIDAK TERSEDIA:
 * - **Tidak ada angka MMR di mana pun.** Satu-satunya field bernuansa MMR di
 *   seluruh schema adalah `PlayerPerformanceType.mmrTier` / `mmrBracket`, dan
 *   itu tingkat/bracket, bukan nilai MMR.
 * - **Tidak ada MMR per match.** `MatchPlayerType` (55 field) tidak memuat
 *   `mmrBefore`/`mmrAfter`/`mmrDelta` atau padanannya.
 *
 * Karena itu MMR tetap harus berupa estimasi/snapshot (lihat Bagian 7), dan
 * `MmrSource` di `@dota/shared` tetap relevan.
 */

export const stratzRankSchema = z.object({
  seasonRankId: z.number().int(),
  // Pengkodean sama seperti rank_tier OpenDota: medal*10 + bintang.
  rank: z.number().int(),
  isCore: z.boolean().nullable().default(null),
  asOfDateTime: z.number().int(), // epoch detik
});
export type StratzRank = z.infer<typeof stratzRankSchema>;

export const stratzLeaderboardRankSchema = z.object({
  seasonRankId: z.number().int(),
  seasonLeaderBoardDivisionId: z.number().int().nullable().default(null),
  rank: z.number().int().nullable().default(null),
  asOfDateTime: z.number().int().nullable().default(null),
});
export type StratzLeaderboardRank = z.infer<typeof stratzLeaderboardRankSchema>;

export const stratzPlayerSchema = z.object({
  steamAccountId: z.number().int(),
  matchCount: z.number().int().nullable().default(null),
  ranks: z.array(stratzRankSchema).default([]),
  leaderboardRanks: z.array(stratzLeaderboardRankSchema).default([]),
});
export type StratzPlayer = z.infer<typeof stratzPlayerSchema>;

export const stratzMatchSchema = z.object({
  id: z.number().int(),
  didRadiantWin: z.boolean().nullable().default(null),
  durationSeconds: z.number().int().nullable().default(null),
  startDateTime: z.number().int().nullable().default(null),
  averageRank: z.number().int().nullable().default(null),
  actualRank: z.number().int().nullable().default(null),
  rank: z.number().int().nullable().default(null),
});
export type StratzMatch = z.infer<typeof stratzMatchSchema>;
