import http2 from 'node:http2';
import PQueue from 'p-queue';
import { z } from 'zod';
import { TTL_FOREVER, TtlCache } from '../cache.js';
import { logger } from '../logger.js';
import {
  stratzMatchSchema,
  stratzPlayerSchema,
  type StratzMatch,
  type StratzPlayer,
} from './types.js';

/**
 * PENTING: STRATZ harus diakses lewat HTTP/2.
 *
 * Cloudflare di depan api.stratz.com menantang (HTTP 403 "Just a moment...")
 * setiap permintaan HTTP/1.1 dari Node. Sudah diuji:
 *   - curl ................. HTTP/2 -> 200
 *   - undici / fetch ....... 403 (walau header User-Agent lengkap, walau
 *                            allowH2: true, walau ALPN dipaksa ['h2'])
 *   - node:http2 ........... 200 di semua varian header
 * Jadi jangan "merapikan" ini menjadi undici seperti client OpenDota.
 *
 * Header `User-Agent` juga WAJIB; tanpa itu curl pun dibalas 403.
 */
const DEFAULT_ENDPOINT = 'https://api.stratz.com/graphql';
const USER_AGENT = 'dota-tracker/0.1 (+https://github.com/Fuiyooo/dota-tracker)';

/** Rank jarang berubah, detail match tidak berubah. */
export const STRATZ_TTL = {
  player: 10 * 60_000,
  match: TTL_FOREVER,
} as const;

export class StratzError extends Error {
  readonly status: number | undefined;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = 'StratzError';
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

export interface StratzClientConfig {
  endpoint: string;
  token: string | undefined;
  userAgent: string;
  timeoutMs: number;
  maxAttempts: number;
  requestsPerMinute: number;
}

export function configFromEnv(): StratzClientConfig {
  return {
    endpoint: DEFAULT_ENDPOINT,
    token: process.env.STRATZ_TOKEN?.trim() || undefined,
    userAgent: USER_AGENT,
    timeoutMs: 20_000,
    maxAttempts: 3,
    requestsPerMinute: 60,
  };
}

interface Http2Response {
  status: number;
  text: string;
}

function http2Post(options: {
  endpoint: string;
  token: string;
  userAgent: string;
  payload: string;
  timeoutMs: number;
}): Promise<Http2Response> {
  const url = new URL(options.endpoint);

  return new Promise((resolve, reject) => {
    const session = http2.connect(url.origin);
    let settled = false;

    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      action();
    };

    session.on('error', (error) => settle(() => reject(error)));

    const request = session.request({
      ':method': 'POST',
      ':path': `${url.pathname}${url.search}`,
      authorization: `Bearer ${options.token}`,
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(options.payload),
      'user-agent': options.userAgent,
    });

    let status = 0;
    let text = '';

    request.setTimeout(options.timeoutMs, () => {
      request.close(http2.constants.NGHTTP2_CANCEL);
      session.close();
      settle(() => reject(new StratzError(`timeout setelah ${options.timeoutMs} ms`)));
    });

    request.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0);
    });
    request.on('data', (chunk: Buffer) => {
      text += chunk.toString('utf8');
    });
    request.on('end', () => {
      session.close();
      settle(() => resolve({ status, text }));
    });
    request.on('error', (error) => {
      session.close();
      settle(() => reject(error));
    });

    request.end(options.payload);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const PLAYER_DOCUMENT = `
  query Player($steamAccountId: Long!) {
    player(steamAccountId: $steamAccountId) {
      steamAccountId
      matchCount
      ranks { seasonRankId rank isCore asOfDateTime }
      leaderboardRanks { seasonRankId seasonLeaderBoardDivisionId rank asOfDateTime }
    }
  }
`;

const MATCH_DOCUMENT = `
  query Match($id: Long!) {
    match(id: $id) {
      id
      didRadiantWin
      durationSeconds
      startDateTime
      averageRank
      actualRank
      rank
    }
  }
`;

export class StratzClient {
  private readonly config: StratzClientConfig;
  private readonly cache: TtlCache;
  private readonly queue: PQueue;

  constructor(config: StratzClientConfig = configFromEnv(), cache: TtlCache = new TtlCache(200)) {
    this.config = config;
    this.cache = cache;
    this.queue = new PQueue({
      concurrency: 1,
      intervalCap: config.requestsPerMinute,
      interval: 60_000,
    });
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  clearCache(): void {
    this.cache.clear();
  }

  /** Histori rank pemain (deret waktu, terbaru lebih dulu). */
  getPlayer(steamAccountId: number): Promise<StratzPlayer> {
    return this.cached(
      `stratz:player:${steamAccountId}`,
      STRATZ_TTL.player,
      PLAYER_DOCUMENT,
      { steamAccountId },
      (data) => data.player,
      stratzPlayerSchema,
    );
  }

  /** Rank rata-rata match; pakai `actualRank` bila `averageRank` null. */
  getMatchRank(matchId: number): Promise<StratzMatch> {
    return this.cached(
      `stratz:match:${matchId}`,
      STRATZ_TTL.match,
      MATCH_DOCUMENT,
      { id: matchId },
      (data) => data.match,
      stratzMatchSchema,
    );
  }

  private cached<T>(
    key: string,
    ttlMs: number,
    document: string,
    variables: Record<string, unknown>,
    pick: (data: Record<string, unknown>) => unknown,
    schema: z.ZodType<T>,
  ): Promise<T> {
    return this.cache.getOrSet(key, ttlMs, () => this.query(document, variables, pick, schema));
  }

  private async query<T>(
    document: string,
    variables: Record<string, unknown>,
    pick: (data: Record<string, unknown>) => unknown,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const result = await this.queue.add(async () => {
      this.assertToken();

      let lastError: unknown;

      for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
        try {
          const response = await http2Post({
            endpoint: this.config.endpoint,
            token: this.config.token as string,
            userAgent: this.config.userAgent,
            payload: JSON.stringify({ query: document, variables }),
            timeoutMs: this.config.timeoutMs,
          });

          if (response.status === 429 || response.status >= 500) {
            throw new StratzError(`STRATZ membalas HTTP ${response.status}`, {
              status: response.status,
              retryable: true,
            });
          }

          if (response.status !== 200) {
            throw new StratzError(
              `STRATZ membalas HTTP ${response.status}: ${response.text.slice(0, 200)}`,
              { status: response.status },
            );
          }

          let parsed: { data?: Record<string, unknown>; errors?: unknown };
          try {
            parsed = JSON.parse(response.text) as typeof parsed;
          } catch {
            throw new StratzError(`Respons STRATZ bukan JSON: ${response.text.slice(0, 200)}`);
          }

          if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
            const serialized = JSON.stringify(parsed.errors);
            // STRATZ kadang membalas HTTP 200 dengan error internal sementara
            // (mis. `NPGSQL TIMEOUT` saat resolve `match`). Itu layak dicoba ulang.
            throw new StratzError(`STRATZ GraphQL error: ${serialized.slice(0, 300)}`, {
              retryable: /TIMEOUT/i.test(serialized),
            });
          }

          if (parsed.data === undefined) {
            throw new StratzError('Respons STRATZ tidak memuat data');
          }

          const value = pick(parsed.data);
          if (value === undefined) {
            throw new StratzError('Data yang diminta tidak ada di respons STRATZ');
          }

          const validated = schema.safeParse(value);
          if (!validated.success) {
            const detail = validated.error.issues
              .slice(0, 3)
              .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
              .join('; ');
            throw new StratzError(`Bentuk respons STRATZ tidak sesuai -> ${detail}`);
          }

          return validated.data;
        } catch (error) {
          lastError = error;
          const retryable = error instanceof StratzError ? error.retryable : true;
          if (!retryable || attempt === this.config.maxAttempts) break;

          const delayMs = Math.min(1_000 * 2 ** (attempt - 1), 10_000) + Math.floor(Math.random() * 500);
          logger.warn('stratz: percobaan gagal, mencoba ulang', {
            attempt,
            delayMs,
            error: messageOf(error),
          });
          await sleep(delayMs);
        }
      }

      logger.error('stratz: permintaan gagal', { error: messageOf(lastError) });
      throw lastError instanceof Error ? lastError : new StratzError(String(lastError));
    });

    if (result === undefined) throw new StratzError('permintaan STRATZ dibatalkan');
    return result;
  }

  private assertToken(): void {
    if (this.config.token === undefined) {
      throw new StratzError(
        'STRATZ_TOKEN belum diisi. Ambil di https://stratz.com/api lalu taruh di .env',
      );
    }
  }
}

let instance: StratzClient | undefined;

export function getStratzClient(): StratzClient {
  instance ??= new StratzClient();
  return instance;
}
