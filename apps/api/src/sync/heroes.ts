import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { heroes } from '../db/schema.js';
import { getOpenDotaClient } from '../opendota/client.js';
import { withSyncLog } from './logs.js';

/** Upsert seluruh daftar hero dari OpenDota `/heroStats`. Idempoten. */
export async function syncHeroes(): Promise<number> {
  return withSyncLog('heroes', null, async () => {
    const stats = await getOpenDotaClient().getHeroStats();

    const rows = stats.map((hero) => ({
      hero_id: hero.id,
      name: hero.name,
      localized_name: hero.localized_name,
      img: hero.img,
      primary_attr: hero.primary_attr,
      roles: hero.roles,
    }));

    await db
      .insert(heroes)
      .values(rows)
      .onConflictDoUpdate({
        target: heroes.hero_id,
        set: {
          name: sql`excluded.name`,
          localized_name: sql`excluded.localized_name`,
          img: sql`excluded.img`,
          primary_attr: sql`excluded.primary_attr`,
          roles: sql`excluded.roles`,
        },
      });

    return rows.length;
  });
}
