import { z } from 'zod';

/** Dipakai sebagai parameter route, contoh GET /players/:accountId */
export const accountIdParamSchema = z.object({
  // uint32, batas atas mengikuti account_id Steam
  accountId: z.coerce.number().int().positive().max(4294967295),
});
export type AccountIdParam = z.infer<typeof accountIdParamSchema>;

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** GET /players/search?q= */
export const playerSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
});
export type PlayerSearchQuery = z.infer<typeof playerSearchQuerySchema>;

/** POST /players - mulai tracking; `query` boleh account_id, steamid64, atau URL/vanity */
export const trackPlayerBodySchema = z.object({
  query: z.string().trim().min(1).max(200),
  tracking_enabled: z.boolean().optional(),
  /** 0 berarti lewati sync match (respons lebih cepat). */
  match_limit: z.coerce.number().int().min(0).max(100).optional(),
});
export type TrackPlayerBody = z.infer<typeof trackPlayerBodySchema>;

/** PATCH /players/:accountId/tracking */
export const trackingToggleBodySchema = z.object({
  enabled: z.boolean(),
});
export type TrackingToggleBody = z.infer<typeof trackingToggleBodySchema>;
