import { sql } from 'drizzle-orm';
import { getOpenDotaClient } from '../opendota/client.js';
import { client, db } from './client.js';
import { heroes } from './schema.js';

async function main(): Promise<void> {
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

  console.log(`Seed selesai: ${rows.length} hero di-upsert.`);
}

await main();
await client.end();
