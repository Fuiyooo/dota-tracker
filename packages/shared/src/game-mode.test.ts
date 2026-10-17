import { describe, expect, it } from 'vitest';
import { describeMatchMode } from './game-mode.js';

describe('describeMatchMode', () => {
  it('menandai lobby ranked (team, solo, dan umum)', () => {
    expect(describeMatchMode(7, 22)).toEqual({
      label: 'Ranked',
      mode: 'All Draft',
      detail: 'Ranked · All Draft',
      ranked: true,
      turbo: false,
    });
    expect(describeMatchMode(5, 1).label).toBe('Ranked');
    expect(describeMatchMode(6, 1).label).toBe('Ranked');
  });

  it('membedakan unranked dari ranked', () => {
    expect(describeMatchMode(0, 22)).toMatchObject({
      label: 'Unranked',
      detail: 'Unranked · All Draft',
      ranked: false,
    });
  });

  it('mendeteksi turbo dari game_mode, bukan dari lobby', () => {
    expect(describeMatchMode(0, 23)).toMatchObject({
      label: 'Turbo',
      detail: 'Turbo',
      turbo: true,
      ranked: false,
    });
    // Turbo tetap Turbo walau lobby-nya bertanda ranked.
    expect(describeMatchMode(7, 23).label).toBe('Turbo');
  });

  it('menampilkan lobby lain apa adanya', () => {
    expect(describeMatchMode(9, 1).detail).toBe('Battle Cup · All Pick');
    expect(describeMatchMode(4, 22).detail).toBe('Co-op Bots · All Draft');
  });

  it('tidak pecah untuk nilai yang tidak dikenal', () => {
    expect(describeMatchMode(99, 99).detail).toBe('Lobby 99 · Mode 99');
    expect(describeMatchMode(0, 0).detail).toBe('Unranked');
  });
});
