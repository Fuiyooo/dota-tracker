import { request } from 'undici';
import { steamId64ToAccountId } from '@dota/shared';
import { logger } from '../logger.js';

const DEFAULT_BASE_URL = 'https://api.steampowered.com';
const USER_AGENT = 'dota-tracker/0.1 (+https://github.com/Fuiyooo/dota-tracker)';

/**
 * Client Steam Web API.
 *
 * Berbeda dari STRATZ (lihat `apps/api/src/stratz/client.ts`), Steam tidak
 * dilindungi Cloudflare, jadi `undici` biasa sudah cukup.
 */
export class SteamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SteamError';
  }
}

interface ResolveVanityResponse {
  response?: {
    steamid?: string;
    success?: number;
    message?: string;
  };
}

interface GetPlayerSummariesResponse {
  response?: {
    players?: Array<{
      steamid?: string;
      personaname?: string;
      avatar?: string;
      avatarmedium?: string;
      avatarfull?: string;
      profileurl?: string;
    }>;
  };
}

export interface SteamSummary {
  steamId64: string;
  accountId: number | null;
  personaname: string | null;
  avatarfull: string | null;
  profileurl: string | null;
}

export interface SteamClientConfig {
  apiKey: string | undefined;
  baseUrl: string;
  timeoutMs: number;
}

export function configFromEnv(): SteamClientConfig {
  return {
    apiKey: process.env.STEAM_API_KEY?.trim() || undefined,
    baseUrl: DEFAULT_BASE_URL,
    timeoutMs: 10_000,
  };
}

export class SteamClient {
  constructor(private readonly config: SteamClientConfig = configFromEnv()) {}

  private async getJson<T>(path: string, params: Record<string, string>): Promise<T> {
    const apiKey = this.config.apiKey;
    if (apiKey === undefined) {
      throw new SteamError('STEAM_API_KEY belum diisi di .env');
    }

    const url = new URL(`${this.config.baseUrl}${path}`);
    for (const [key, value] of Object.entries({ ...params, key: apiKey })) {
      url.searchParams.set(key, value);
    }

    const response = await request(url, {
      method: 'GET',
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      headersTimeout: this.config.timeoutMs,
      bodyTimeout: this.config.timeoutMs,
    });

    if (response.statusCode !== 200) {
      const text = await response.body.text();
      throw new SteamError(`Steam membalas HTTP ${response.statusCode}: ${text.slice(0, 200)}`);
    }

    return (await response.body.json()) as T;
  }

  /**
   * Ubah nama vanity menjadi account_id.
   *
   * `ResolveVanityURL` mengembalikan `success: 1` bila ketemu, dan `success: 42`
   * (atau nilai lain) bila tidak ada. Keduanya HTTP 200, jadi statusnya tidak
   * bisa dipakai untuk membedakan.
   */
  async resolveVanityUrl(vanity: string): Promise<number | null> {
    const data = await this.getJson<ResolveVanityResponse>(
      '/ISteamUser/ResolveVanityURL/v0001/',
      { vanityurl: vanity },
    );

    const steamId64 = data.response?.steamid;
    if (data.response?.success !== 1 || steamId64 === undefined) {
      logger.debug('steam: vanity tidak ditemukan', {
        vanity,
        message: data.response?.message,
      });
      return null;
    }

    try {
      return steamId64ToAccountId(steamId64);
    } catch {
      logger.warn('steam: steamid dari ResolveVanityURL tidak masuk akal', { vanity, steamId64 });
      return null;
    }
  }

  /** Ringkasan profil dari Steam; berguna saat data OpenDota belum ada. */
  async getPlayerSummary(steamId64: string): Promise<SteamSummary | null> {
    const data = await this.getJson<GetPlayerSummariesResponse>(
      '/ISteamUser/GetPlayerSummaries/v0002/',
      { steamids: steamId64 },
    );

    const player = data.response?.players?.[0];
    if (player === undefined || player.steamid === undefined) return null;

    let accountId: number | null = null;
    try {
      accountId = steamId64ToAccountId(player.steamid);
    } catch {
      accountId = null;
    }

    return {
      steamId64: player.steamid,
      accountId,
      personaname: player.personaname ?? null,
      avatarfull: player.avatarfull ?? null,
      profileurl: player.profileurl ?? null,
    };
  }
}

let instance: SteamClient | undefined;

export function getSteamClient(): SteamClient {
  instance ??= new SteamClient();
  return instance;
}
