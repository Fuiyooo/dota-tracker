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
