import { accountIdToSteamId64 } from '@dota/shared';
import { db } from '../db/client.js';
import { players } from '../db/schema.js';
import { getOpenDotaClient } from '../opendota/client.js';
import { epochNow, withSyncLog } from './logs.js';

/**
 * Upsert profil + rank seorang pemain.
 *
 * `tracking_enabled` sengaja TIDAK ikut diperbarui: itu preferensi pengguna,
 * bukan data dari OpenDota, jadi tidak boleh tertimpa setiap kali sync jalan.
 */
export async function syncPlayerProfile(accountId: number) {
  return withSyncLog('profile', accountId, async () => {
    const data = await getOpenDotaClient().getPlayer(accountId);

    if (data.profile === null) {
      throw new Error(`Profil ${accountId} tidak ditemukan di OpenDota`);
    }

    const steamId64 = data.profile.steamid ?? accountIdToSteamId64(data.profile.account_id);
    const values = {
      account_id: data.profile.account_id,
      steam_id64: steamId64,
      personaname: data.profile.personaname,
      avatar: data.profile.avatarfull ?? data.profile.avatar,
      rank_tier: data.rank_tier,
      leaderboard_rank: data.leaderboard_rank,
      computed_mmr: data.computed_mmr,
      last_synced_at: epochNow(),
    };

    const updated = await db
      .insert(players)
      .values(values)
      .onConflictDoUpdate({
        target: players.account_id,
        set: {
          steam_id64: values.steam_id64,
          personaname: values.personaname,
          avatar: values.avatar,
          rank_tier: values.rank_tier,
          leaderboard_rank: values.leaderboard_rank,
          computed_mmr: values.computed_mmr,
          last_synced_at: values.last_synced_at,
        },
      })
      .returning();

    const row = updated[0];
    if (row === undefined) throw new Error('upsert players tidak mengembalikan baris');
    return row;
  });
}
