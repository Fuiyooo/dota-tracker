const BASE = '/api';

export const HERO_IMG_CDN = 'https://cdn.cloudflare.steamstatic.com';

export interface SearchResult {
  account_id: number;
  personaname: string | null;
  avatarfull: string | null;
  last_match_time: string | null;
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
}

export interface Hero {
  hero_id: number;
  name: string;
  localized_name: string;
  img: string;
  primary_attr: string;
  roles: string[];
}

export interface Health {
  ok: boolean;
  database: 'up' | 'down';
  opendota: { day: string; used: number; limit: number };
  cacheSize: number;
  uptimeSeconds: number;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export const getHealth = () => getJson<Health>('/health');

export const searchPlayers = (q: string) =>
  getJson<SearchResult[]>(`/players/search?q=${encodeURIComponent(q)}`);

export const getPlayer = (accountId: number) => getJson<PlayerProfile>(`/players/${accountId}`);

export const getPlayerMatches = (accountId: number, limit = 20) =>
  getJson<PlayerMatch[]>(`/players/${accountId}/matches?limit=${limit}`);

export const getHeroes = () => getJson<Hero[]>('/heroes');
