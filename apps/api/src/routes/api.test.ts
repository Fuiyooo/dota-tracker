import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDatabase, seedFixture, TEST_ACCOUNT_ID } from '../../test/helpers.js';

const { getOpenDotaClientMock } = vi.hoisted(() => ({ getOpenDotaClientMock: vi.fn() }));

// Endpoint /summary memanggil OpenDota untuk total seumur hidup. Di tes kita
// tidak boleh menyentuh jaringan, jadi client-nya diganti tiruan.
vi.mock('../opendota/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../opendota/client.js')>();
  return { ...actual, getOpenDotaClient: getOpenDotaClientMock };
});

const { buildServer } = await import('../server.js');

let app: FastifyInstance;

beforeAll(async () => {
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  getOpenDotaClientMock.mockReturnValue({
    getPlayerWinLoss: async () => ({ win: 100, lose: 50 }),
    getPlayer: async () => ({
      profile: null,
      rank_tier: null,
      leaderboard_rank: null,
      computed_mmr: null,
    }),
  });

  await resetDatabase();
  await seedFixture();
});

describe('GET /api/health', () => {
  it('melaporkan database hidup', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, database: 'up' });
  });
});

describe('GET /api/heroes', () => {
  it('mengembalikan hero dari database', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/heroes' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
  });
});

describe('GET /api/players/:accountId', () => {
  it('membaca dari database lebih dulu', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/players/${TEST_ACCOUNT_ID}` });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.source).toBe('database');
    expect(body.rank_label).toBe('Archon 1');
    expect(body.computed_mmr).toBe(3903.28);
  });

  it('menolak accountId di luar uint32', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/players/99999999999' });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /api/players/:accountId/matches', () => {
  it('menghormati limit dan mengurutkan dari yang terbaru', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/players/${TEST_ACCOUNT_ID}/matches?limit=1`,
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].match_id).toBe(9000000002);
    expect(body[0].source).toBe('database');
  });

  it('menolak limit di atas batas', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/players/${TEST_ACCOUNT_ID}/matches?limit=999`,
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /api/players/:accountId/heroes', () => {
  it('menghitung games, wins, dan winrate per hero', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/players/${TEST_ACCOUNT_ID}/heroes`,
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.synced_matches).toBe(2);

    const zeus = body.heroes.find((hero: { hero_id: number }) => hero.hero_id === 22);
    const antiMage = body.heroes.find((hero: { hero_id: number }) => hero.hero_id === 1);

    expect(zeus).toMatchObject({ games: 1, wins: 1, winrate: 1 });
    expect(antiMage).toMatchObject({ games: 1, wins: 0, winrate: 0 });
  });
});

describe('GET /api/players/:accountId/summary', () => {
  it('menghitung wins/losses dan streak dari match tersinkron', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/players/${TEST_ACCOUNT_ID}/summary`,
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.synced).toMatchObject({
      synced_matches: 2,
      wins: 1,
      losses: 1,
      winrate: 0.5,
      current_streak: { type: 'win', length: 1 },
    });
    expect(body.lifetime).toEqual({ win: 100, lose: 50 });
  });
});

describe('GET /api/players/:accountId/mmr-history', () => {
  it('menghitung delta dan mengatribusikan match terakhir', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/players/${TEST_ACCOUNT_ID}/mmr-history`,
    });
    const entries = response.json().entries as Array<Record<string, unknown>>;

    expect(response.statusCode).toBe(200);
    expect(entries).toHaveLength(2);

    expect(entries[0]).toMatchObject({ mmr_delta: null, match_id: 9000000001 });
    expect(entries[1]).toMatchObject({ mmr_delta: 3.28, rank_delta: 1, match_id: 9000000002 });
  });
});

describe('PATCH /api/players/:accountId/tracking', () => {
  it('mematikan tracking', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/players/${TEST_ACCOUNT_ID}/tracking`,
      payload: { enabled: false },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ tracking_enabled: false, sync_failures: 0 });
  });

  it('404 untuk akun yang belum pernah di-track', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/players/1/tracking',
      payload: { enabled: true },
    });
    expect(response.statusCode).toBe(404);
  });

  it('400 untuk body yang tidak valid', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/players/${TEST_ACCOUNT_ID}/tracking`,
      payload: { enabled: 'ya' },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /api/sync/status', () => {
  it('memuat akun tracked beserta field backoff', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/sync/status' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.tracked_players).toHaveLength(1);
    expect(body.tracked_players[0]).toMatchObject({
      account_id: TEST_ACCOUNT_ID,
      sync_failures: 0,
      next_sync_at: null,
    });
  });
});
