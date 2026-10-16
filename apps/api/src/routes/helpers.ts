import { accountIdToSteamId64 } from '@dota/shared';
import type { FastifyReply } from 'fastify';

export function badRequest(reply: FastifyReply, error: string, issues?: unknown) {
  return reply.code(400).send({ error, issues });
}

/** `account_id` bisa di luar rentang SteamID64; jangan sampai melempar. */
export function safeSteamId64(accountId: number): string | null {
  try {
    return accountIdToSteamId64(accountId);
  } catch {
    return null;
  }
}
