import { describe, expect, it } from 'vitest';
import {
  RANK_MEDALS,
  estimateCurrentMmr,
  estimateMmrRange,
  formatMmrEstimate,
  rankTierLabel,
  rankTierToMedal,
} from './ranks.js';

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

describe('estimateMmrRange', () => {
  it('menurunkan rentang dari medal resmi', () => {
    // 11 = Herald 1, 41 = Archon 1, 55 = Legend 5, 75 = Divine 5
    expect(estimateMmrRange(11)).toEqual({ min: 0, max: 154, openEnded: false });
    expect(estimateMmrRange(41)).toEqual({ min: 2310, max: 2464, openEnded: false });
    expect(estimateMmrRange(55)).toEqual({ min: 3696, max: 3850, openEnded: false });
    expect(estimateMmrRange(75)).toEqual({ min: 5236, max: 5390, openEnded: false });
  });

  it('Immortal tidak punya batas atas', () => {
    expect(estimateMmrRange(80)).toEqual({ min: 5390, max: 5390, openEnded: true });
  });

  it('null untuk rank yang tidak sah', () => {
    expect(estimateMmrRange(null)).toBeNull();
    expect(estimateMmrRange(0)).toBeNull();
    expect(estimateMmrRange(50)).toBeNull();
  });
});

describe('formatMmrEstimate', () => {
  it('memformat rentang dan batas terbuka', () => {
    expect(formatMmrEstimate({ min: 2310, max: 2464, openEnded: false })).toBe('2310–2464 MMR');
    expect(formatMmrEstimate({ min: 5390, max: 5390, openEnded: true })).toBe('5390+ MMR');
  });
});

describe('estimateCurrentMmr', () => {
  it('netral saat menang-kalah seimbang (tengah band)', () => {
    // Archon 1: 2310–2464, tengah = 2387.
    const estimate = estimateCurrentMmr(41, 10, 10);
    expect(estimate).toMatchObject({ value: 2387, formDelta: 0, basedOn: 20 });
  });

  it('turun saat lebih banyak kalah, walau rank tetap Archon 1', () => {
    // net -5 -> -125
    expect(estimateCurrentMmr(41, 4, 9)?.value).toBe(2262);
    // net -2 -> -50
    expect(estimateCurrentMmr(41, 4, 6)?.value).toBe(2337);
  });

  it('naik saat lebih banyak menang', () => {
    // net +4 -> +100
    expect(estimateCurrentMmr(41, 7, 3)?.value).toBe(2487);
  });

  it('membatasi geseran maksimal satu bintang', () => {
    // net -20 seharusnya -500, dibatasi -154.
    expect(estimateCurrentMmr(41, 0, 20)?.value).toBe(2387 - 154);
    expect(estimateCurrentMmr(41, 20, 0)?.value).toBe(2387 + 154);
  });

  it('Immortal berjangkar di batas bawah (tidak ada batas atas)', () => {
    expect(estimateCurrentMmr(80, 5, 5)?.value).toBe(5390);
  });

  it('null untuk rank yang tidak sah', () => {
    expect(estimateCurrentMmr(null, 5, 5)).toBeNull();
    expect(estimateCurrentMmr(0, 5, 5)).toBeNull();
  });
});
