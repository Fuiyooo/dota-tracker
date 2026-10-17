export const RANK_MEDALS = {
  1: 'Herald',
  2: 'Guardian',
  3: 'Crusader',
  4: 'Archon',
  5: 'Legend',
  6: 'Ancient',
  7: 'Divine',
  8: 'Immortal',
} as const;

export type RankMedal = (typeof RANK_MEDALS)[keyof typeof RANK_MEDALS];

export interface RankInfo {
  medal: RankMedal;
  star: number;
}

const IMMORTAL = 8;

function medalFor(medalNumber: number): RankMedal | undefined {
  return Object.prototype.hasOwnProperty.call(RANK_MEDALS, medalNumber)
    ? RANK_MEDALS[medalNumber as keyof typeof RANK_MEDALS]
    : undefined;
}

/**
 * OpenDota menyandikan rank sebagai `medal * 10 + star`, contoh 53 = Legend 3.
 * Nilai sah: 11..15, 21..25, ..., 71..75, dan 80 (Immortal tanpa bintang).
 */
export function rankTierToMedal(rankTier: number | null | undefined): RankInfo | null {
  if (typeof rankTier !== 'number' || !Number.isInteger(rankTier) || rankTier <= 0) {
    return null;
  }

  const medalNumber = Math.floor(rankTier / 10);
  const star = rankTier % 10;
  const medal = medalFor(medalNumber);
  if (medal === undefined) return null;

  if (medalNumber === IMMORTAL) {
    return star === 0 ? { medal, star } : null;
  }

  return star >= 1 && star <= 5 ? { medal, star } : null;
}

export function rankTierLabel(
  rankTier: number | null | undefined,
  leaderboardRank?: number | null,
): string {
  const info = rankTierToMedal(rankTier);
  if (info === null) return 'Unranked';

  const onLeaderboard =
    info.medal === RANK_MEDALS[IMMORTAL] &&
    typeof leaderboardRank === 'number' &&
    leaderboardRank > 0;

  if (onLeaderboard) return `${info.medal} #${leaderboardRank}`;

  return info.star > 0 ? `${info.medal} ${info.star}` : info.medal;
}

/** Satu bintang diperkirakan setara 154 MMR, jadi satu medal = 770. */
export const MMR_PER_STAR = 154;

export interface MmrEstimate {
  min: number;
  max: number;
  /** Immortal tidak punya batas atas yang dipublikasikan. */
  openEnded: boolean;
}

/**
 * Perkiraan rentang MMR dari `rank_tier` (medal resmi).
 *
 * Kenapa bukan angka pasti:
 * - Valve **tidak** mempublikasikan MMR.
 * - `computed_mmr` OpenDota terbukti tidak cocok dengan medal — akun uji
 *   `rank_tier` 41 (Archon 1) tetapi `computed_mmr` 3903, padahal Archon 1
 *   berada di kisaran 2310–2464. Karena itu angka itu tidak dipakai lagi.
 *
 * Satu-satunya data resmi adalah medal, jadi rentang di bawah diturunkan dari
 * pemetaan umum komunitas (154 MMR per bintang). Sebut sebagai perkiraan.
 */
export function estimateMmrRange(rankTier: number | null | undefined): MmrEstimate | null {
  const info = rankTierToMedal(rankTier);
  if (info === null || typeof rankTier !== 'number') return null;

  const medalNumber = Math.floor(rankTier / 10);

  if (medalNumber === IMMORTAL) {
    const min = 35 * MMR_PER_STAR; // 5390
    return { min, max: min, openEnded: true };
  }

  const steps = (medalNumber - 1) * 5 + Math.max(info.star - 1, 0);
  const min = steps * MMR_PER_STAR;
  return { min, max: min + MMR_PER_STAR, openEnded: false };
}

export function formatMmrEstimate(estimate: MmrEstimate): string {
  return estimate.openEnded ? `${estimate.min}+ MMR` : `${estimate.min}–${estimate.max} MMR`;
}

/** Rata-rata MMR yang didapat/hilang per match ranked. */
export const MMR_PER_WIN = 25;

export interface CurrentMmrEstimate {
  /** Angka tunggal yang ditampilkan, mis. 2262. */
  value: number;
  /** Band medal yang jadi jangkar. */
  band: MmrEstimate;
  /** Geseran dari tengah band akibat hasil match (+ menang, - kalah). */
  formDelta: number;
  /** Jumlah match ranked yang dipakai menghitung geseran. */
  basedOn: number;
}

/**
 * Perkiraan MMR "sekarang": titik di dalam band medal yang digeser oleh hasil
 * match ranked terakhir.
 *
 * Kenapa begini:
 * - Valve tidak mempublikasikan MMR, dan MMR tidak selalu sejajar dengan medal.
 *   Pemain Archon 1 yang sedang kalah bisa berada di 2260, masih Archon 1
 *   karena belum melewati batas bawah band (2310).
 * - Jangkar: titik tengah band medal (Archon 1 -> 2387).
 * - Geseran: `(menang - kalah) * 25`, dibatasi ±154 (satu bintang) supaya tidak
 *   melebar jauh dari band.
 *
 * `wins`/`losses` sebaiknya hanya dari match RANKED; Turbo punya pool MMR
 * sendiri sehingga tidak menggambarkan MMR ranked.
 *
 * Ini heuristik, bukan pengukuran. Sebut sebagai perkiraan.
 */
export function estimateCurrentMmr(
  rankTier: number | null | undefined,
  wins: number,
  losses: number,
): CurrentMmrEstimate | null {
  const band = estimateMmrRange(rankTier);
  if (band === null) return null;

  const neutral = band.openEnded ? band.min : band.min + (band.max - band.min) / 2;
  const netWins = wins - losses;
  const formDelta = Math.max(-MMR_PER_STAR, Math.min(MMR_PER_STAR, netWins * MMR_PER_WIN));

  return {
    value: Math.round(neutral + formDelta),
    band,
    formDelta,
    basedOn: wins + losses,
  };
}
