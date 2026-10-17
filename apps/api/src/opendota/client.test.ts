import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenDotaClient, OpenDotaError, type OpenDotaClientConfig } from './client.js';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('undici', () => ({ request: requestMock }));

function config(overrides: Partial<OpenDotaClientConfig> = {}): OpenDotaClientConfig {
  return {
    baseUrl: 'https://api.opendota.com/api',
    apiKey: undefined,
    requestsPerMinute: 1000,
    dailyLimit: 2000,
    userAgent: 'dota-tracker-test',
    timeoutMs: 1000,
    maxAttempts: 1,
    ...overrides,
  };
}

/** Tiruan respons `undici.request`. */
function response(statusCode: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    statusCode,
    headers: {},
    body: {
      json: async () => JSON.parse(text),
      text: async () => text,
      dump: async () => undefined,
    },
  };
}

const playerBody = {
  profile: {
    account_id: 1061259054,
    personaname: 'Nyenyenye',
    steamid: '76561199021524782',
    avatar: 'https://a.example/a.jpg',
    avatarfull: 'https://a.example/a_full.jpg',
    profileurl: 'https://steamcommunity.com/profiles/76561199021524782/',
    last_login: null,
  },
  rank_tier: 41,
  leaderboard_rank: null,
  computed_mmr: 3903.28,
};

const matchBody = {
  match_id: 9000000001,
  start_time: 1792000000,
  duration: 1800,
  radiant_win: true,
  game_mode: 22,
  lobby_type: 7,
  radiant_score: 25,
  dire_score: 31,
  players: [
    {
      account_id: 1061259054,
      player_slot: 0,
      hero_id: 1,
      isRadiant: true,
      kills: 3,
      deaths: 8,
      assists: 5,
      gold_per_min: 400,
      xp_per_min: 500,
      last_hits: 90,
      hero_damage: 12000,
      hero_healing: 0,
      rank_tier: 41,
    },
    {
      // Pemain dengan profil privat: account_id tidak dikirim OpenDota.
      account_id: null,
      player_slot: 1,
      hero_id: 2,
      isRadiant: true,
      kills: 1,
      deaths: 1,
      assists: 1,
      gold_per_min: 300,
      xp_per_min: 300,
      last_hits: 10,
      hero_damage: 1000,
      hero_healing: 0,
      rank_tier: null,
    },
  ],
};

beforeEach(() => {
  requestMock.mockReset();
});

describe('OpenDotaClient', () => {
  it('mengurai respons profil yang valid', async () => {
    requestMock.mockResolvedValue(response(200, playerBody));
    const player = await new OpenDotaClient(config()).getPlayer(1061259054);

    expect(player.profile?.personaname).toBe('Nyenyenye');
    expect(player.rank_tier).toBe(41);
  });

  it('menerima computed_mmr desimal (regresi: bukan integer)', async () => {
    requestMock.mockResolvedValue(response(200, playerBody));
    const player = await new OpenDotaClient(config()).getPlayer(1061259054);

    expect(player.computed_mmr).toBe(3903.28);
  });

  it('menerima pemain tanpa account_id di detail match (profil privat)', async () => {
    requestMock.mockResolvedValue(response(200, matchBody));
    const match = await new OpenDotaClient(config()).getMatch(9000000001);

    expect(match.players).toHaveLength(2);
    expect(match.players[1]?.account_id).toBeNull();
  });

  it('menolak bentuk respons yang tidak sesuai', async () => {
    requestMock.mockResolvedValue(response(200, { profile: null, rank_tier: 'tinggi' }));

    await expect(new OpenDotaClient(config()).getPlayer(1)).rejects.toBeInstanceOf(OpenDotaError);
  });

  it('404 langsung gagal tanpa mencoba ulang', async () => {
    requestMock.mockResolvedValue(response(404, { error: 'Not Found' }));

    await expect(new OpenDotaClient(config({ maxAttempts: 3 })).getPlayer(1)).rejects.toThrow(
      /404/,
    );
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('500 dicoba ulang sebanyak maxAttempts', async () => {
    requestMock.mockResolvedValue(response(500, 'boom'));

    await expect(
      new OpenDotaClient(config({ maxAttempts: 2 })).getPlayer(1),
    ).rejects.toBeInstanceOf(OpenDotaError);
    expect(requestMock).toHaveBeenCalledTimes(2);
  }, 15_000);

  it('mengirim api_key hanya bila dikonfigurasi', async () => {
    requestMock.mockResolvedValue(response(200, playerBody));

    await new OpenDotaClient(config()).getPlayer(1061259054);
    const withoutKey = String(requestMock.mock.calls[0]?.[0]);
    expect(withoutKey).not.toContain('api_key');

    requestMock.mockClear();
    await new OpenDotaClient(config({ apiKey: 'rahasia' })).getPlayer(1061259054);
    const withKey = String(requestMock.mock.calls[0]?.[0]);
    expect(withKey).toContain('api_key=rahasia');
  });

  it('berhenti saat kuota harian habis tanpa memanggil HTTP', async () => {
    await expect(new OpenDotaClient(config({ dailyLimit: 0 })).getPlayer(1)).rejects.toThrow(
      /Kuota harian/,
    );
    expect(requestMock).not.toHaveBeenCalled();
  });
});
