import { sql } from 'drizzle-orm';
import { client, db } from './client.js';
import { heroes } from './schema.js';

const OPENDOTA_BASE = 'https://api.opendota.com/api';

interface OpenDotaHeroStats {
  id: number;
  name: string;
  localized_name: string;
  img: string;
  primary_attr: string;
  roles: string[];
}

async function main(): Promise<void> {
  const response = await fetch(`${OPENDOTA_BASE}/heroStats`);
  if (!response.ok) {
    throw new Error(`OpenDota /heroStats gagal: HTTP ${response.status}`);
  }

  const stats = (await response.json()) as OpenDotaHeroStats[];

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
