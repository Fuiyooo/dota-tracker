import { describe, expect, it } from 'vitest';
import { RANK_MEDALS, rankTierLabel, rankTierToMedal } from './ranks.js';

describe('RANK_MEDALS', () => {
  it('memuat 8 medal', () => {
    expect(Object.values(RANK_MEDALS)).toEqual([
      'Herald',
      'Guardian',
      'Crusader',
      'Archon',
      'Legend',
      'Ancient',
      'Divine',
      'Immortal',
    ]);
  });
});

describe('rankTierToMedal', () => {
  it('mengubah rank_tier menjadi medal + bintang', () => {
    expect(rankTierToMedal(11)).toEqual({ medal: 'Herald', star: 1 });
    expect(rankTierToMedal(53)).toEqual({ medal: 'Legend', star: 3 });
    expect(rankTierToMedal(75)).toEqual({ medal: 'Divine', star: 5 });
    expect(rankTierToMedal(80)).toEqual({ medal: 'Immortal', star: 0 });
  });

  it('mengembalikan null untuk nilai yang tidak sah', () => {
    expect(rankTierToMedal(null)).toBeNull();
    expect(rankTierToMedal(undefined)).toBeNull();
    expect(rankTierToMedal(0)).toBeNull();
    expect(rankTierToMedal(50)).toBeNull(); // bintang 0 tidak sah kecuali Immortal
    expect(rankTierToMedal(85)).toBeNull(); // Immortal tidak punya bintang
    expect(rankTierToMedal(90)).toBeNull(); // medal 9 tidak ada
    expect(rankTierToMedal(-53)).toBeNull();
  });
});

describe('rankTierLabel', () => {
  it('menyusun label yang bisa dibaca', () => {
    expect(rankTierLabel(53)).toBe('Legend 3');
    expect(rankTierLabel(80)).toBe('Immortal');
    expect(rankTierLabel(80, 1234)).toBe('Immortal #1234');
    expect(rankTierLabel(53, 999)).toBe('Legend 3'); // leaderboard diabaikan
    expect(rankTierLabel(null)).toBe('Unranked');
    expect(rankTierLabel(80, 0)).toBe('Immortal'); // leaderboard 0 tidak bermakna
  });
});
