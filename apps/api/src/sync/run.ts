import '../env.js';
import { client as dbClient } from '../db/client.js';
import { logger } from '../logger.js';
import { syncHeroes, syncPlayer } from './index.js';

const USAGE = `Pemakaian:
  pnpm --filter @dota/api sync --heroes
  pnpm --filter @dota/api sync <accountId>
  pnpm --filter @dota/api sync <accountId> --match-limit 5
  pnpm --filter @dota/api sync --heroes <accountId>`;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const withHeroes = args.includes('--heroes');
  const limitIndex = args.indexOf('--match-limit');
  const rawLimit = limitIndex === -1 ? undefined : args[limitIndex + 1];
  const matchLimit = rawLimit === undefined ? undefined : Number(rawLimit);

  const accountArg = args.find((arg) => /^\d+$/.test(arg));
  const accountId = accountArg === undefined ? undefined : Number(accountArg);

  if (!withHeroes && accountId === undefined) {
    console.log(USAGE);
    return;
  }

  if (withHeroes) {
    const count = await syncHeroes();
    console.log(`Heroes      : ${count} baris di-upsert`);
  }

  if (accountId !== undefined) {
    const result = await syncPlayer(accountId, { matchLimit });
    console.log(
      `Profil      : ${result.profile.personaname ?? '(tanpa nama)'} | rank_tier ${result.profile.rank_tier} | MMR ${result.profile.computed_mmr}`,
    );
    console.log(
      `Matches     : ${result.matches.checked} diperiksa, ${result.matches.alreadyStored} sudah ada, ${result.matches.synced} baru disimpan`,
    );
  }
}

try {
  await main();
} catch (error) {
  logger.error('sync berhenti karena error', { error: messageOf(error) });
  process.exitCode = 1;
} finally {
  await dbClient.end({ timeout: 5 });
}
