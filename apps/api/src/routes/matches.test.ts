import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { getOpenDotaClientMock } = vi.hoisted(() => ({ getOpenDotaClientMock: vi.fn() }));

vi.mock('../opendota/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../opendota/client.js')>();
  return { ...actual, getOpenDotaClient: getOpenDotaClientMock };
});

const { buildServer } = await import('../server.js');
const { OpenDotaError } = await import('../opendota/client.js');

const RADIANT_SLOTS = [0, 1, 2, 3, 4];
const DIRE_SLOTS = [128, 129, 130, 131, 132];

function player(slot: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    account_id: 100000 + slot,
    personaname: `Player ${slot}`,
    player_slot: slot,
    hero_id: 1 + (slot % 5),
    isRadiant: slot < 128,
    kills: 5,
    deaths: 3,
    assists: 7,
    gold_per_min: 500,
    xp_per_min: 600,
    last_hits: 150,
    denies: 5,
    net_worth: 20000,
    level: 25,
    hero_damage: 15000,
    hero_healing: 0,
    rank_tier: 41,
    ...overrides,
  };
}

function matchFixture(overrides: Record<string, unknown> = {}) {
  return {
    match_id: 9043331899,
    start_time: 1791904938,
    duration: 1583,
    radiant_win: false,
    game_mode: 23,
    lobby_type: 0,
    radiant_score: 26,
    dire_score: 32,
    players: [...RADIANT_SLOTS, ...DIRE_SLOTS].map((slot) => player(slot)),
    ...overrides,
  };
}

let app: FastifyInstance;

beforeAll(async () => {
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  getOpenDotaClientMock.mockReset();
});

describe('GET /api/matches/:matchId', () => {
  it('memetakan detail match beserta mode dan kedua tim', async () => {
    getOpenDotaClientMock.mockReturnValue({ getMatch: async () => matchFixture() });

    const response = await app.inject({ method: 'GET', url: '/api/matches/9043331899' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      match_id: 9043331899,
      mode: 'Turbo',
      radiant_score: 26,
      dire_score: 32,
      source: 'opendota',
    });
    expect(body.players).toHaveLength(10);
    expect(body.players.filter((p: { is_radiant: boolean }) => p.is_radiant)).toHaveLength(5);
    expect(body.players.filter((p: { is_radiant: boolean }) => !p.is_radiant)).toHaveLength(5);

    // Diurutkan berdasarkan player_slot.
    const slots = body.players.map((p: { player_slot: number }) => p.player_slot);
    expect(slots).toEqual([...slots].sort((a, b) => a - b));
  });

  it('tetap menampilkan pemain berprofil privat (tanpa account_id)', async () => {
    const fixture = matchFixture();
    fixture.players[1] = player(1, { account_id: null, personaname: null, rank_tier: null });

    getOpenDotaClientMock.mockReturnValue({ getMatch: async () => fixture });

    const response = await app.inject({ method: 'GET', url: '/api/matches/9043331899' });
    const anon = response.json().players.find((p: { player_slot: number }) => p.player_slot === 1);

    expect(anon).toMatchObject({
      account_id: null,
      personaname: null,
      hero_id: player(1).hero_id,
      kills: 5,
      net_worth: 20000,
    });
  });

  it('menghitung average_rank dari pemain yang punya rank_tier', async () => {
    const fixture = matchFixture();
    fixture.players[0] = player(0, { rank_tier: null });

    getOpenDotaClientMock.mockReturnValue({ getMatch: async () => fixture });

    const response = await app.inject({ method: 'GET', url: '/api/matches/9043331899' });
    expect(response.json().average_rank).toBe(41);
  });

  it('average_rank null bila tidak ada pemain yang punya rank', async () => {
    const fixture = matchFixture();
    fixture.players = fixture.players.map((p) => ({ ...p, rank_tier: null }));

    getOpenDotaClientMock.mockReturnValue({ getMatch: async () => fixture });

    const response = await app.inject({ method: 'GET', url: '/api/matches/9043331899' });
    expect(response.json().average_rank).toBeNull();
  });

  it('404 bila match tidak ditemukan di OpenDota', async () => {
    getOpenDotaClientMock.mockReturnValue({
      getMatch: async () => {
        throw new OpenDotaError('Not Found', { status: 404 });
      },
    });

    const response = await app.inject({ method: 'GET', url: '/api/matches/1' });
    expect(response.statusCode).toBe(404);
  });

  it('400 untuk matchId yang bukan angka', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/matches/abc' });
    expect(response.statusCode).toBe(400);
  });
});
