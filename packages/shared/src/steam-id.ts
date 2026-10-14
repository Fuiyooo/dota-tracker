const STEAM_ID64_BASE = 76561197960265728n;
const ACCOUNT_ID_MAX = 4294967295; // 2^32 - 1

const STEAM_ID64_RE = /^7656\d{13}$/;
const VANITY_RE = /^[A-Za-z0-9_.-]{1,64}$/;

export type SteamIdInput =
  | { kind: 'accountId'; accountId: number }
  | { kind: 'steamId64'; accountId: number; steamId64: string }
  | { kind: 'vanity'; vanity: string }
  | { kind: 'invalid'; input: string };

export function isValidAccountId(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= ACCOUNT_ID_MAX;
}

/**
 * SteamID64 jauh di atas `Number.MAX_SAFE_INTEGER`, jadi perhitungannya wajib
 * memakai BigInt. Contoh jebakan: account_id 1 -> steamid64 76561197960265729,
 * tapi `Number('76561197960265729') - 76561197960265728` menghasilkan 0.
 */
export function steamId64ToAccountId(steamId64: string): number {
  if (!STEAM_ID64_RE.test(steamId64)) {
    throw new RangeError(`Bukan SteamID64 yang valid: ${steamId64}`);
  }

  const accountId = BigInt(steamId64) - STEAM_ID64_BASE;
  if (accountId <= 0n || accountId > BigInt(ACCOUNT_ID_MAX)) {
    throw new RangeError(`SteamID64 di luar rentang yang wajar: ${steamId64}`);
  }

  return Number(accountId);
}

export function accountIdToSteamId64(accountId: number): string {
  if (!isValidAccountId(accountId)) {
    throw new RangeError(`account_id tidak valid: ${accountId}`);
  }

  return (BigInt(accountId) + STEAM_ID64_BASE).toString();
}

/** Ubah deretan angka menjadi account_id, atau null kalau di luar rentang. */
function toAccountId(digits: string | undefined): number | null {
  if (digits === undefined) return null;
  const value = Number(digits);
  return isValidAccountId(value) ? value : null;
}

function fromSteamId64(steamId64: string, original: string): SteamIdInput {
  try {
    return { kind: 'steamId64', accountId: steamId64ToAccountId(steamId64), steamId64 };
  } catch {
    return { kind: 'invalid', input: original };
  }
}

function parseUrl(url: string, original: string): SteamIdInput {
  // https://steamcommunity.com/profiles/76561198083722517
  const profile = /\/profiles\/(\d{17})\/?$/.exec(url);
  if (profile !== null && profile[1] !== undefined) {
    return fromSteamId64(profile[1], original);
  }

  // https://steamcommunity.com/id/gaben
  const vanity = /\/id\/([^/?#]+)\/?$/.exec(url);
  if (vanity !== null && vanity[1] !== undefined) {
    let name: string;
    try {
      name = decodeURIComponent(vanity[1]);
    } catch {
      return { kind: 'invalid', input: original };
    }
    return VANITY_RE.test(name)
      ? { kind: 'vanity', vanity: name }
      : { kind: 'invalid', input: original };
  }

  // https://www.opendota.com/players/123456789 (juga dotabuff, dll)
  const players = /\/players\/(\d{1,10})\/?$/.exec(url);
  if (players !== null) {
    const accountId = toAccountId(players[1]);
    return accountId === null
      ? { kind: 'invalid', input: original }
      : { kind: 'accountId', accountId };
  }

  return { kind: 'invalid', input: original };
}

/**
 * Tebak bentuk input tanpa melakukan panggilan jaringan sama sekali.
 * Resolusi vanity -> account_id yang butuh HTTP dilakukan di `apps/api`.
 */
export function parseSteamIdInput(input: string): SteamIdInput {
  const raw = input.trim();
  if (raw === '') return { kind: 'invalid', input };

  // SteamID3, contoh: [U:1:123456789]
  const steamId3 = /^\[U:1:(\d{1,10})\]$/.exec(raw);
  if (steamId3 !== null) {
    const accountId = toAccountId(steamId3[1]);
    return accountId === null ? { kind: 'invalid', input } : { kind: 'accountId', accountId };
  }

  if (/^https?:\/\//i.test(raw)) {
    return parseUrl(raw, input);
  }

  // SteamID64: 17 digit, selalu diawali 7656
  if (STEAM_ID64_RE.test(raw)) {
    return fromSteamId64(raw, input);
  }

  // Deretan angka: account_id kalau <= 10 digit dan masuk rentang
  if (/^\d+$/.test(raw)) {
    const accountId = toAccountId(raw);
    return accountId === null ? { kind: 'invalid', input } : { kind: 'accountId', accountId };
  }

  if (VANITY_RE.test(raw)) return { kind: 'vanity', vanity: raw };

  return { kind: 'invalid', input };
}
