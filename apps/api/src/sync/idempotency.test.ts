import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_ACCOUNT_ID, TEST_STEAM_ID64, resetDatabase } from '../../test/helpers.js';
import { db } from '../db/client.js';
import { matchPlayers, matches, players } from '../db/schema.js';
import { syncAccount } from './account.js';
import { syncMatchDetail } from './matches.js';
import { syncPlayerProfile } from './players.js';

const { getOpenDotaClientMock } = vi.hoisted(() => ({ getOpenDotaClientMock: vi.fn() }));

vi.mock('../opendota/client.js', () => ({ getOpenDotaClient: getOpenDotaClientMock }));

const matchFixture = {
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
      account_id: TEST_ACCOUNT_ID,
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
      // Profil privat: tidak punya account_id, harus dilewati.
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

const playerFixture = {
  profile: {
    account_id: TEST_ACCOUNT_ID,
    personaname: 'Nyenyenye',
    steamid: TEST_STEAM_ID64,
    avatar: 'https://a.example/a.jpg',
    avatarfull: 'https://a.example/a_full.jpg',
    profileurl: 'https://steamcommunity.com/profiles/76561199021524782/',
    last_login: null,
  },
  rank_tier: 41,
  leaderboard_rank: null,
  computed_mmr: 3903.28,
};

async function countRows(table: typeof matches | typeof matchPlayers): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(table);
  return rows[0]?.count ?? 0;
}

beforeEach(async () => {
  getOpenDotaClientMock.mockReturnValue({
    getMatch: async () => matchFixture,
    getPlayer: async () => playerFixture,
    getPlayerRecentMatches: async () => [],
  });

  await resetDatabase();
});

describe('idempotensi sync', () => {
  it('syncMatchDetail dua kali tidak menambah baris', async () => {
    await syncMatchDetail(9000000001);
    const firstMatches = await countRows(matches);
    const firstPlayers = await countRows(matchPlayers);

    await syncMatchDetail(9000000001);

    expect(await countRows(matches)).toBe(firstMatches);
    expect(await countRows(matchPlayers)).toBe(firstPlayers);

    // Hanya pemain yang punya account_id yang disimpan.
    expect(firstMatches).toBe(1);
    expect(firstPlayers).toBe(1);
  });

  it('syncPlayerProfile tidak menimpa tracking_enabled', async () => {
    await syncPlayerProfile(TEST_ACCOUNT_ID);

    await db
      .update(players)
      .set({ tracking_enabled: false })
      .where(eq(players.account_id, TEST_ACCOUNT_ID));

    await syncPlayerProfile(TEST_ACCOUNT_ID);

    const rows = await db
      .select({ tracking_enabled: players.tracking_enabled })
      .from(players)
      .where(eq(players.account_id, TEST_ACCOUNT_ID));

    expect(rows[0]?.tracking_enabled).toBe(false);
  });

  it('syncAccount yang berhasil mereset backoff', async () => {
    await syncPlayerProfile(TEST_ACCOUNT_ID);

    // `next_sync_at` bertipe integer (epoch detik), jadi harus < 2^31.
    const future = Math.floor(Date.now() / 1000) + 3600;
    await db
      .update(players)
      .set({ sync_failures: 3, next_sync_at: future })
      .where(eq(players.account_id, TEST_ACCOUNT_ID));

    await syncAccount(TEST_ACCOUNT_ID);

    const rows = await db
      .select({ sync_failures: players.sync_failures, next_sync_at: players.next_sync_at })
      .from(players)
      .where(eq(players.account_id, TEST_ACCOUNT_ID));

    expect(rows[0]).toEqual({ sync_failures: 0, next_sync_at: null });
  });
});
