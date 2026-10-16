import { describe, expect, it } from 'vitest';
import { mmrSnapshotSchema } from './mmr.js';

describe('mmrSnapshotSchema', () => {
  const base = {
    id: 1,
    account_id: 1061259054,
    recorded_at: 1786717101,
    rank_tier: 41,
    leaderboard_rank: null,
    computed_mmr: 3960.07,
    source: 'estimate' as const,
  };

  it('menerima computed_mmr desimal (bukan integer)', () => {
    expect(mmrSnapshotSchema.parse(base).computed_mmr).toBe(3960.07);
  });

  it('menerima source stratz', () => {
    expect(mmrSnapshotSchema.parse({ ...base, source: 'stratz' }).source).toBe('stratz');
  });

  it('menolak source yang tidak dikenal', () => {
    expect(() => mmrSnapshotSchema.parse({ ...base, source: 'valve' })).toThrow();
  });
});
