const BASE = '/api';

export const HERO_IMG_CDN = 'https://cdn.cloudflare.steamstatic.com';

export interface SearchResult {
  account_id: number;
  personaname: string | null;
  avatarfull: string | null;
  last_match_time: string | null;
  rank_tier?: number | null;
  resolved_from?: 'account_id' | 'steamid64' | 'vanity' | 'name';
}

export interface PlayerProfile {
  account_id: number;
  steam_id64: string | null;
  personaname: string | null;
  avatar: string | null;
  rank_tier: number | null;
  leaderboard_rank: number | null;
  computed_mmr: number | null;
  rank_label: string;
  tracking_enabled: boolean;
  last_synced_at: number | null;
  source: 'database' | 'opendota';
}

export interface PlayerMatch {
  match_id: number;
  hero_id: number;
  start_time: number;
  duration: number;
  lobby_type: number;
  game_mode: number;
  player_slot: number;
  is_radiant: boolean;
  won: boolean;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_min: number;
  xp_per_min: number;
  last_hits: number;
  hero_damage: number;
  hero_healing: number;
  party_size: number | null;
  average_rank: number | null;
  source?: string;
}

export interface Hero {
  hero_id: number;
  name: string;
  localized_name: string;
  img: string;
  primary_attr: string;
  roles: string[];
}

export interface ItemRef {
  id: number;
  name: string;
  dname: string | null;
  img: string | null;
  cost: number | null;
}

export interface MatchPick {
  order: number;
  /** 0 = Radiant, 1 = Dire */
  team: number;
  hero_id: number;
}

export interface MatchDetailPlayer {
  player_slot: number;
  account_id: number | null;
  personaname: string | null;
  hero_id: number;
  is_radiant: boolean;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_min: number;
  xp_per_min: number;
  last_hits: number;
  denies: number | null;
  net_worth: number | null;
  level: number | null;
  hero_damage: number;
  hero_healing: number;
  items: ItemRef[];
  backpack: ItemRef[];
  neutral: ItemRef | null;
}

export interface MatchDetail {
  match_id: number;
  start_time: number;
  duration: number;
  radiant_win: boolean;
  lobby_type: number;
  game_mode: number;
  mode: string;
  radiant_score: number | null;
  dire_score: number | null;
  average_rank: number | null;
  picks: MatchPick[];
  players: MatchDetailPlayer[];
  source: string;
}

export interface HeroStat {
  hero_id: number;
  localized_name: string | null;
  img: string | null;
  games: number;
  wins: number;
  winrate: number;
}

export interface PlayerHeroResponse {
  account_id: number;
  synced_matches: number;
  heroes: HeroStat[];
  source: string;
}

export interface PlayerSummary {
  account_id: number;
  rank_tier: number | null;
  leaderboard_rank: number | null;
  rank_label: string;
  computed_mmr: number | null;
  synced: {
    account_id: number;
    synced_matches: number;
    wins: number;
    losses: number;
    winrate: number;
    current_streak: { type: 'win' | 'loss'; length: number } | null;
    top_heroes: HeroStat[];
  };
  lifetime: { win: number; lose: number } | null;
}

export interface MmrHistoryEntry {
  id: number;
  recorded_at: number;
  rank_tier: number | null;
  leaderboard_rank: number | null;
  computed_mmr: number | null;
  source: string;
  mmr_delta: number | null;
  rank_delta: number | null;
  match_id: number | null;
}

export interface SyncStatus {
  opendota: { day: string; used: number; limit: number };
  cacheSize: number;
  tracked_players: Array<{
    account_id: number;
    personaname: string | null;
    avatar: string | null;
    rank_tier: number | null;
    computed_mmr: number | null;
    tracking_enabled: boolean;
    last_synced_at: number | null;
  }>;
  recent_logs: Array<{
    id: number;
    account_id: number | null;
    scope: string;
    started_at: number;
    finished_at: number | null;
    status: string;
    error: string | null;
  }>;
}

export interface TrackPlayerResponse {
  player: {
    account_id: number;
    personaname: string | null;
  } | null;
  resolved_from: string;
  tracking_enabled: boolean;
  matches: { checked: number; alreadyStored: number; synced: number } | null;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// --- Endpoint ------------------------------------------------------------

export const searchPlayers = (q: string) =>
  getJson<SearchResult[]>(`/players/search?q=${encodeURIComponent(q)}`);

export const getPlayer = (accountId: number) => getJson<PlayerProfile>(`/players/${accountId}`);

export const getPlayerMatches = (accountId: number, limit = 20) =>
  getJson<PlayerMatch[]>(`/players/${accountId}/matches?limit=${limit}`);

export const getPlayerHeroes = (accountId: number) =>
  getJson<PlayerHeroResponse>(`/players/${accountId}/heroes`);

export const getPlayerSummary = (accountId: number) =>
  getJson<PlayerSummary>(`/players/${accountId}/summary`);

export const getMmrHistory = (accountId: number) =>
  getJson<{ account_id: number; entries: MmrHistoryEntry[]; source: string }>(
    // `paginationQuerySchema` membatasi limit maksimum 100.
    `/players/${accountId}/mmr-history?limit=100`,
  );

export const getHeroes = () => getJson<Hero[]>('/heroes');

export const getMatchDetail = (matchId: number) => getJson<MatchDetail>(`/matches/${matchId}`);

export const getSyncStatus = () => getJson<SyncStatus>('/sync/status');

export const trackPlayer = (query: string, matchLimit = 20) =>
  postJson<TrackPlayerResponse>('/players', { query, match_limit: matchLimit });

export const syncPlayer = (accountId: number) =>
  postJson<{
    account_id: number;
    personaname: string | null;
    rank_tier: number | null;
    computed_mmr: number | null;
    matches: { checked: number; alreadyStored: number; synced: number };
  }>(`/players/${accountId}/sync`, {});
