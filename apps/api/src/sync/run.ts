import '../env.js';
import { client as dbClient } from '../db/client.js';
import { logger } from '../logger.js';
import { backfillRanksFromStratz, snapshotMmr, syncHeroes, syncPlayer } from './index.js';
import { runScheduledSync } from '../scheduler.js';

const USAGE = `Pemakaian:
  pnpm --filter @dota/api sync --heroes
  pnpm --filter @dota/api sync <accountId>
  pnpm --filter @dota/api sync <accountId> --match-limit 5
  pnpm --filter @dota/api sync --snapshot-mmr
  pnpm --filter @dota/api sync <accountId> --backfill-ranks
  pnpm --filter @dota/api sync --scheduler-once
  pnpm --filter @dota/api sync --heroes --snapshot-mmr <accountId>`;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const withHeroes = args.includes('--heroes');
  const withSnapshot = args.includes('--snapshot-mmr');
  const withBackfill = args.includes('--backfill-ranks');
  const withSchedulerOnce = args.includes('--scheduler-once');
  const limitIndex = args.indexOf('--match-limit');
  const rawLimit = limitIndex === -1 ? undefined : args[limitIndex + 1];
  const matchLimit = rawLimit === undefined ? undefined : Number(rawLimit);

  const accountArg = args.find((arg) => /^\d+$/.test(arg));
  const accountId = accountArg === undefined ? undefined : Number(accountArg);

  if (!withHeroes && !withSnapshot && !withBackfill && !withSchedulerOnce && accountId === undefined) {
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

  if (withSnapshot) {
    const snapshot = await snapshotMmr();
    console.log(
      `Snapshot    : ${snapshot.snapshots}/${snapshot.accounts} akun tersimpan, ${snapshot.failures.length} gagal`,
    );
    for (const change of snapshot.changes) {
      console.log(
        `  akun ${change.accountId}: MMR ${change.previousMmr} -> ${change.mmr} (delta ${change.mmrDelta}) | rank_tier ${change.previousRankTier} -> ${change.rankTier} (delta ${change.rankDelta})`,
      );
    }
    for (const failure of snapshot.failures) {
      console.log(`  akun ${failure.accountId} GAGAL: ${failure.error}`);
    }
  }

  if (withBackfill) {
    if (accountId === undefined) {
      console.log('--backfill-ranks membutuhkan <accountId>');
      return;
    }
    const backfill = await backfillRanksFromStratz(accountId);
    console.log(
      `Backfill    : ${backfill.inserted} entri rank STRATZ disimpan, ${backfill.skipped} dilewati (dari ${backfill.total})`,
    );
  }

  if (withSchedulerOnce) {
    const result = await runScheduledSync();
    console.log(
      `Scheduler   : ${result.due}/${result.tracked} akun jatuh tempo | ${result.succeeded} sukses, ${result.failed} gagal, ${result.skipped} ditunda (backoff)`,
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
