export { syncHeroes } from './heroes.js';
export { syncPlayerProfile } from './players.js';
export { syncMatchDetail, syncPlayerMatches } from './matches.js';
export { withSyncLog, epochNow, type SyncScope, type SyncStatus } from './logs.js';

import { syncPlayerMatches } from './matches.js';
import { syncPlayerProfile } from './players.js';

/**
 * Jalankan seluruh langkah sync untuk satu akun: profil lalu match.
 *
 * Urutannya penting — `players` harus ada lebih dulu supaya profilnya segar
 * saat match disinkronkan.
 */
export async function syncPlayer(accountId: number, options: { matchLimit?: number } = {}) {
  const profile = await syncPlayerProfile(accountId);
  const matches = await syncPlayerMatches(accountId, { limit: options.matchLimit });
  return { profile, matches };
}
