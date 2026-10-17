import { sql } from 'drizzle-orm';
import { db } from '../src/db/client.js';

/** Kosongkan seluruh tabel data. Dipakai di `beforeEach` tes integrasi. */
export async function resetDatabase(): Promise<void> {
  await db.execute(
    sql`truncate table match_players, matches, mmr_snapshots, sync_logs, players, heroes restart identity cascade`,
  );
}

export const TEST_ACCOUNT_ID = 1061259054;
export const TEST_STEAM_ID64 = '76561199021524782';

/**
 * Data uji minimal: 2 hero, 1 pemain, 2 match (satu menang, satu kalah),
 * dan 2 snapshot MMR.
 */
export async function seedFixture(): Promise<void> {
  await db.execute(sql`
    insert into heroes (hero_id, name, localized_name, img, primary_attr, roles) values
      (1, 'npc_dota_hero_antimage', 'Anti-Mage', '/img/antimage.png', 'agi', array['Carry']),
      (22, 'npc_dota_hero_zuus', 'Zeus', '/img/zuus.png', 'int', array['Nuker'])
  `);

  await db.execute(sql`
    insert into players (account_id, steam_id64, personaname, avatar, rank_tier, computed_mmr, tracking_enabled)
    values (${TEST_ACCOUNT_ID}, ${TEST_STEAM_ID64}, 'Nyenyenye', '/img/avatar.png', 41, 3903.28, true)
  `);

  // Match 1 lebih baru dan MENANG (Radiant, player_slot 0).
  // Match 2 lebih lama dan KALAH (Dire, player_slot 129).
  await db.execute(sql`
    insert into matches (match_id, start_time, duration, radiant_win, game_mode, lobby_type, average_rank, radiant_score, dire_score) values
      (9000000002, 1792000200, 2400, true, 22, 7, 42, 30, 20),
      (9000000001, 1792000000, 1800, true, 22, 7, 41, 25, 31)
  `);

  await db.execute(sql`
    insert into match_players (match_id, account_id, hero_id, is_radiant, player_slot, kills, deaths, assists, gpm, xpm, last_hits, hero_damage, hero_healing) values
      (9000000002, ${TEST_ACCOUNT_ID}, 22, true, 0, 10, 2, 15, 600, 700, 150, 30000, 0),
      (9000000001, ${TEST_ACCOUNT_ID}, 1, false, 129, 3, 8, 5, 400, 500, 90, 12000, 0)
  `);

  await db.execute(sql`
    insert into mmr_snapshots (account_id, recorded_at, rank_tier, leaderboard_rank, computed_mmr, source) values
      (${TEST_ACCOUNT_ID}, 1792000100, 40, null, 3900.0, 'estimate'),
      (${TEST_ACCOUNT_ID}, 1792000300, 41, null, 3903.28, 'estimate')
  `);
}
