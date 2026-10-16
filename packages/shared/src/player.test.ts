import { describe, expect, it } from 'vitest';
import { playerSchema } from './player.js';

describe('playerSchema', () => {
  // Nilai diambil dari respons asli OpenDota untuk account_id 1061259054
  const base = {
    account_id: 1061259054,
    steam_id64: '76561199021524782',
    personaname: 'Nyenyenye',
    avatar: 'https://avatars.steamstatic.com/7a4f85a4b492b487481a3a0cba26d8731effad73.jpg',
    rank_tier: 41,
    leaderboard_rank: null,
    computed_mmr: 3960.07,
    tracking_enabled: true,
    last_synced_at: null,
  };

  it('menerima computed_mmr desimal (persis seperti OpenDota)', () => {
    expect(playerSchema.parse(base).computed_mmr).toBe(3960.07);
  });

  it('menerima computed_mmr null untuk akun yang belum terkalibrasi', () => {
    expect(playerSchema.parse({ ...base, computed_mmr: null }).computed_mmr).toBeNull();
  });

  it('menerima account_id batas atas', () => {
    expect(playerSchema.parse({ ...base, account_id: 4294967295 }).account_id).toBe(4294967295);
  });

  it('menolak account_id dan steam_id64 yang tidak masuk akal', () => {
    expect(() => playerSchema.parse({ ...base, account_id: -1 })).toThrow();
    expect(() => playerSchema.parse({ ...base, account_id: 1.5 })).toThrow();
    expect(() => playerSchema.parse({ ...base, steam_id64: '123' })).toThrow();
  });
});
