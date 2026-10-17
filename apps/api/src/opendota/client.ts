import PQueue from 'p-queue';
import { request } from 'undici';
import { z } from 'zod';
import { TTL_FOREVER, TtlCache } from '../cache.js';
import { logger } from '../logger.js';
import {
  openDotaHeroStatSchema,
  openDotaMatchSchema,
  openDotaPlayerHeroSchema,
  openDotaPlayerMatchSchema,
  openDotaPlayerSchema,
  openDotaRecentMatchSchema,
  openDotaSearchResultSchema,
  openDotaWinLossSchema,
  type OpenDotaHeroStat,
  type OpenDotaMatch,
  type OpenDotaPlayer,
  type OpenDotaPlayerHero,
  type OpenDotaPlayerMatch,
  type OpenDotaRecentMatch,
  type OpenDotaSearchResult,
  type OpenDotaWinLoss,
} from './types.js';

/** TTL cache sesuai Bagian 4 TODO.md. */
export const OPENDOTA_TTL = {
  profile: 10 * 60_000,
  matches: 2 * 60_000,
  heroStats: 24 * 60 * 60_000,
  matchDetail: TTL_FOREVER,
} as const;

export class OpenDotaError extends Error {
  readonly status: number | undefined;
  readonly retryable: boolean;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    message: string,
    options: { status?: number; retryable?: boolean; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = 'OpenDotaError';
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export interface OpenDotaClientConfig {
  baseUrl: string;
  apiKey: string | undefined;
  requestsPerMinute: number;
  /** Batas free tier: 2000 permintaan/hari. */
  dailyLimit: number;
  userAgent: string;
  timeoutMs: number;
  maxAttempts: number;
}

export function configFromEnv(): OpenDotaClientConfig {
  return {
    baseUrl: 'https://api.opendota.com/api',
    apiKey: process.env.OPENDOTA_API_KEY?.trim() || undefined,
    requestsPerMinute: 60,
    dailyLimit: 2000,
    userAgent: 'dota-tracker/0.1 (+https://github.com/Fuiyooo/dota-tracker)',
    timeoutMs: 15_000,
    maxAttempts: 3,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function retryDelay(attempt: number, error: unknown): number {
  const retryAfter = error instanceof OpenDotaError ? error.retryAfterSeconds : undefined;
  if (retryAfter !== undefined) return retryAfter * 1000;
  const base = Math.min(1_000 * 2 ** (attempt - 1), 15_000);
  return base + Math.floor(Math.random() * 500);
}

export class OpenDotaClient {
  private readonly config: OpenDotaClientConfig;
  private readonly cache: TtlCache;
  private readonly queue: PQueue;
  private dayKey = '';
  private dayCount = 0;

  constructor(config: OpenDotaClientConfig = configFromEnv(), cache: TtlCache = new TtlCache(500)) {
    this.config = config;
    this.cache = cache;
    this.queue = new PQueue({
      concurrency: 2,
      intervalCap: config.requestsPerMinute,
      interval: 60_000,
    });
  }

  get dailyUsage(): { day: string; used: number; limit: number } {
    return { day: this.dayKey, used: this.dayCount, limit: this.config.dailyLimit };
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  clearCache(): void {
    this.cache.clear();
  }

  // --- Endpoint ---------------------------------------------------------

  getPlayer(accountId: number): Promise<OpenDotaPlayer> {
    return this.cached(
      `player:${accountId}`,
      OPENDOTA_TTL.profile,
      `/players/${accountId}`,
      openDotaPlayerSchema,
    );
  }

  searchPlayers(query: string): Promise<OpenDotaSearchResult[]> {
    return this.cached(
      `search:${query.trim().toLowerCase()}`,
      OPENDOTA_TTL.profile,
      `/search?q=${encodeURIComponent(query.trim())}`,
      z.array(openDotaSearchResultSchema),
    );
  }

  getPlayerMatches(accountId: number): Promise<OpenDotaPlayerMatch[]> {
    return this.cached(
      `player-matches:${accountId}`,
      OPENDOTA_TTL.matches,
      `/players/${accountId}/matches`,
      z.array(openDotaPlayerMatchSchema),
    );
  }

  getPlayerRecentMatches(accountId: number): Promise<OpenDotaRecentMatch[]> {
    return this.cached(
      `player-recent:${accountId}`,
      OPENDOTA_TTL.matches,
      `/players/${accountId}/recentMatches`,
      z.array(openDotaRecentMatchSchema),
    );
  }

  getPlayerHeroes(accountId: number): Promise<OpenDotaPlayerHero[]> {
    return this.cached(
      `player-heroes:${accountId}`,
      OPENDOTA_TTL.profile,
      `/players/${accountId}/heroes`,
      z.array(openDotaPlayerHeroSchema),
    );
  }

  getPlayerWinLoss(accountId: number): Promise<OpenDotaWinLoss> {
    return this.cached(
      `player-wl:${accountId}`,
      OPENDOTA_TTL.profile,
      `/players/${accountId}/wl`,
      openDotaWinLossSchema,
    );
  }

  getMatch(matchId: number): Promise<OpenDotaMatch> {
    return this.cached(
      `match:${matchId}`,
      OPENDOTA_TTL.matchDetail,
      `/matches/${matchId}`,
      openDotaMatchSchema,
    );
  }

  getHeroStats(): Promise<OpenDotaHeroStat[]> {
    return this.cached(
      'hero-stats',
      OPENDOTA_TTL.heroStats,
      '/heroStats',
      z.array(openDotaHeroStatSchema),
    );
  }

  // --- Internal ---------------------------------------------------------

  private cached<T>(key: string, ttlMs: number, path: string, schema: z.ZodType<T>): Promise<T> {
    return this.cache.getOrSet(key, ttlMs, () => this.request(path, schema));
  }

  private async request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const result = await this.queue.add(() => this.execute(path, schema));
    if (result === undefined) throw new OpenDotaError(`permintaan dibatalkan: ${path}`);
    return result;
  }

  private async execute<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    this.assertDailyBudget();

    const url = new URL(`${this.config.baseUrl}${path}`);
    if (this.config.apiKey !== undefined) url.searchParams.set('api_key', this.config.apiKey);

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const response = await request(url, {
          method: 'GET',
          headers: { accept: 'application/json', 'user-agent': this.config.userAgent },
          headersTimeout: this.config.timeoutMs,
          bodyTimeout: this.config.timeoutMs,
        });

        if (response.statusCode === 429 || response.statusCode >= 500) {
          const retryAfter = Number(response.headers['retry-after'] ?? 0);
          await response.body.dump();
          throw new OpenDotaError(`OpenDota membalas HTTP ${response.statusCode}`, {
            status: response.statusCode,
            retryable: true,
            retryAfterSeconds: retryAfter > 0 ? retryAfter : undefined,
          });
        }

        if (response.statusCode !== 200) {
          const text = await response.body.text();
          throw new OpenDotaError(
            `OpenDota membalas HTTP ${response.statusCode}: ${text.slice(0, 200)}`,
            { status: response.statusCode },
          );
        }

        const parsed = schema.safeParse(await response.body.json());
        if (!parsed.success) {
          const detail = parsed.error.issues
            .slice(0, 3)
            .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('; ');
          throw new OpenDotaError(
            `Bentuk respons OpenDota tidak sesuai untuk ${path} -> ${detail}`,
          );
        }

        logger.debug('opendota: respons diterima', { path, attempt });
        return parsed.data;
      } catch (error) {
        lastError = error;
        const retryable = error instanceof OpenDotaError ? error.retryable : true;
        if (!retryable || attempt === this.config.maxAttempts) break;

        const delayMs = retryDelay(attempt, error);
        logger.warn('opendota: percobaan gagal, mencoba ulang', {
          path,
          attempt,
          delayMs,
          error: messageOf(error),
        });
        await sleep(delayMs);
      }
    }

    logger.error('opendota: permintaan gagal', { path, error: messageOf(lastError) });
    throw lastError instanceof Error ? lastError : new OpenDotaError(String(lastError));
  }

  private assertDailyBudget(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.dayKey) {
      this.dayKey = today;
      this.dayCount = 0;
    }
    if (this.dayCount >= this.config.dailyLimit) {
      throw new OpenDotaError(
        `Kuota harian OpenDota habis (${this.config.dailyLimit} permintaan). Coba lagi besok atau pakai OPENDOTA_API_KEY.`,
      );
    }
    this.dayCount += 1;
  }
}

let instance: OpenDotaClient | undefined;

/** Singleton agar rate limiter dan cache dipakai bersama seluruh proses. */
export function getOpenDotaClient(): OpenDotaClient {
  instance ??= new OpenDotaClient();
  return instance;
}
