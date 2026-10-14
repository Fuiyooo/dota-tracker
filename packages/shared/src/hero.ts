import { z } from 'zod';

export const heroSchema = z.object({
  hero_id: z.number().int().positive(),
  name: z.string(), // npc_dota_hero_antimage
  localized_name: z.string(), // Anti-Mage
  img: z.string(),
  // str | agi | int | all | universal - sengaja longgar karena berasal dari API eksternal
  primary_attr: z.string(),
  roles: z.array(z.string()),
});
export type Hero = z.infer<typeof heroSchema>;

/** Ringkasan performa pemain pada satu hero (dari /players/{id}/heroes). */
export const playerHeroStatsSchema = z.object({
  hero_id: z.number().int().positive(),
  games: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
});
export type PlayerHeroStats = z.infer<typeof playerHeroStatsSchema>;
