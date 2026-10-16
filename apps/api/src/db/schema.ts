import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
} from 'drizzle-orm/pg-core';

/**
 * Konvensi kolom:
 * - snake_case, sama seperti respons OpenDota dan schema zod di `@dota/shared`,
 *   supaya hasil query bisa langsung dicocokkan tanpa konversi.
 * - waktu disimpan sebagai epoch detik (`integer`), bukan `timestamptz`.
 */
export const players = pgTable('players', {
  account_id: integer('account_id').primaryKey(),
  steam_id64: text('steam_id64').notNull(),
  personaname: text('personaname'),
  avatar: text('avatar'),
  rank_tier: integer('rank_tier'),
  leaderboard_rank: integer('leaderboard_rank'),
  // desimal, mis. 3960.07 - jangan pakai integer
  computed_mmr: doublePrecision('computed_mmr'),
  tracking_enabled: boolean('tracking_enabled').notNull().default(true),
  last_synced_at: integer('last_synced_at'),
});

export const matches = pgTable(
  'matches',
  {
    // match_id asli (mis. 9043331899) melebihi batas integer 32-bit Postgres
    match_id: bigint('match_id', { mode: 'number' }).primaryKey(),
    start_time: integer('start_time').notNull(),
    duration: integer('duration').notNull(),
    radiant_win: boolean('radiant_win').notNull(),
    game_mode: integer('game_mode').notNull(),
    lobby_type: integer('lobby_type').notNull(),
    average_rank: integer('average_rank'),
    radiant_score: integer('radiant_score'),
    dire_score: integer('dire_score'),
  },
  (t) => [index('matches_start_time_idx').on(t.start_time)],
);

export const heroes = pgTable('heroes', {
  hero_id: integer('hero_id').primaryKey(),
  name: text('name').notNull(),
  localized_name: text('localized_name').notNull(),
  img: text('img').notNull(),
  primary_attr: text('primary_attr').notNull(),
  roles: text('roles').array().notNull(),
});

export const matchPlayers = pgTable(
  'match_players',
  {
    match_id: bigint('match_id', { mode: 'number' })
      .notNull()
      .references(() => matches.match_id),
    // Sengaja TANPA foreign key ke `players`: kita menyimpan KESEPULUH pemain
    // sebuah match, dan hampir semuanya bukan akun yang di-track. Pemain tanpa
    // `account_id` (profil privat) dilewati saat sync.
    account_id: integer('account_id').notNull(),
    // Sengaja TANPA foreign key ke `heroes`: kalau hero baru dirilis dan match
    // tersinkron sebelum seed hero dijalankan ulang, FK akan menggagalkan sync.
    hero_id: integer('hero_id').notNull(),
    is_radiant: boolean('is_radiant').notNull(),
    player_slot: integer('player_slot').notNull(),
    kills: integer('kills').notNull(),
    deaths: integer('deaths').notNull(),
    assists: integer('assists').notNull(),
    gpm: integer('gpm').notNull(),
    xpm: integer('xpm').notNull(),
    last_hits: integer('last_hits').notNull(),
    hero_damage: integer('hero_damage').notNull(),
    hero_healing: integer('hero_healing').notNull(),
    mmr_before: integer('mmr_before'),
    mmr_after: integer('mmr_after'),
    mmr_delta: integer('mmr_delta'),
    mmr_source: text('mmr_source'),
  },
  (t) => [
    primaryKey({ columns: [t.match_id, t.account_id] }),
    index('match_players_account_id_hero_id_idx').on(t.account_id, t.hero_id),
  ],
);

export const mmrSnapshots = pgTable(
  'mmr_snapshots',
  {
    id: serial('id').primaryKey(),
    account_id: integer('account_id')
      .notNull()
      .references(() => players.account_id),
    recorded_at: integer('recorded_at').notNull(),
    rank_tier: integer('rank_tier'),
    leaderboard_rank: integer('leaderboard_rank'),
    computed_mmr: doublePrecision('computed_mmr'),
    source: text('source').notNull(),
  },
  (t) => [index('mmr_snapshots_account_id_recorded_at_idx').on(t.account_id, t.recorded_at)],
);

export const syncLogs = pgTable('sync_logs', {
  id: serial('id').primaryKey(),
  account_id: integer('account_id'),
  scope: text('scope').notNull(),
  started_at: integer('started_at').notNull(),
  finished_at: integer('finished_at'),
  status: text('status').notNull(),
  error: text('error'),
});
