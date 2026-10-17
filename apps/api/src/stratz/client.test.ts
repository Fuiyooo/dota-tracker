import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StratzClient, StratzError, type StratzClientConfig } from './client.js';

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }));

// Client STRATZ memakai `import http2 from 'node:http2'`, jadi mock-nya butuh
// properti `default`.
vi.mock('node:http2', () => ({
  default: { connect: connectMock, constants: { NGHTTP2_CANCEL: 8 } },
}));

interface FakeRequest extends EventEmitter {
  setTimeout: () => void;
  close: () => void;
  end: () => void;
}

interface FakeSession extends EventEmitter {
  close: () => void;
  request: () => FakeRequest;
}

function fakeSession(status: number, body: string): FakeSession {
  const session = new EventEmitter() as FakeSession;
  session.close = () => undefined;

  session.request = () => {
    const request = new EventEmitter() as FakeRequest;
    request.setTimeout = () => undefined;
    request.close = () => undefined;
    request.end = () => {
      setImmediate(() => {
        request.emit('response', { ':status': status });
        request.emit('data', Buffer.from(body));
        request.emit('end');
      });
    };
    return request;
  };

  return session;
}

function config(overrides: Partial<StratzClientConfig> = {}): StratzClientConfig {
  return {
    endpoint: 'https://api.stratz.com/graphql',
    token: 'token-uji',
    userAgent: 'dota-tracker-test',
    timeoutMs: 1000,
    maxAttempts: 1,
    requestsPerMinute: 1000,
    ...overrides,
  };
}

const playerPayload = {
  data: {
    player: {
      steamAccountId: 1061259054,
      matchCount: 2123,
      ranks: [{ seasonRankId: 5, rank: 35, isCore: true, asOfDateTime: 1787988246 }],
      leaderboardRanks: [],
    },
  },
};

beforeEach(() => {
  connectMock.mockReset();
});

describe('StratzClient', () => {
  it('mengurai hasil query player', async () => {
    connectMock.mockReturnValue(fakeSession(200, JSON.stringify(playerPayload)));

    const player = await new StratzClient(config()).getPlayer(1061259054);

    expect(player.steamAccountId).toBe(1061259054);
    expect(player.matchCount).toBe(2123);
    expect(player.ranks[0]?.rank).toBe(35);
  });

  it('melempar StratzError saat GraphQL mengembalikan errors', async () => {
    connectMock.mockReturnValue(
      fakeSession(200, JSON.stringify({ errors: [{ message: 'Error trying to resolve field' }] })),
    );

    await expect(new StratzClient(config()).getPlayer(1)).rejects.toBeInstanceOf(StratzError);
  });

  it('error TIMEOUT dianggap layak dicoba ulang', async () => {
    connectMock.mockReturnValue(
      fakeSession(
        200,
        JSON.stringify({
          errors: [{ message: 'timeout', extensions: { code: 'NPGSQL', codes: ['TIMEOUT'] } }],
        }),
      ),
    );

    await expect(new StratzClient(config({ maxAttempts: 2 })).getPlayer(1)).rejects.toBeInstanceOf(
      StratzError,
    );
    expect(connectMock).toHaveBeenCalledTimes(2);
  }, 15_000);

  it('menolak status HTTP selain 200', async () => {
    connectMock.mockReturnValue(fakeSession(403, 'Just a moment...'));

    await expect(new StratzClient(config()).getPlayer(1)).rejects.toThrow(/403/);
  });

  it('memakai cache pada query berikutnya', async () => {
    connectMock.mockReturnValue(fakeSession(200, JSON.stringify(playerPayload)));
    const client = new StratzClient(config());

    await client.getPlayer(1061259054);
    await client.getPlayer(1061259054);

    expect(connectMock).toHaveBeenCalledTimes(1);
  });
});
