import { estimateMmrRange, formatMmrEstimate } from '@dota/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getMmrHistory, getPlayer, getPlayerMatches, getPlayerSummary, syncPlayer } from '../api';
import { ErrorBox, Loading } from '../components/Feedback';
import MatchTable from '../components/MatchTable';
import MmrChart from '../components/MmrChart';
import SummaryPanel from '../components/SummaryPanel';

export default function PlayerPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = Number(params.accountId);
  const validId = Number.isFinite(accountId) && accountId > 0;
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['player', accountId],
    queryFn: () => getPlayer(accountId),
    enabled: validId,
  });

  const matchesQuery = useQuery({
    queryKey: ['matches', accountId],
    queryFn: () => getPlayerMatches(accountId),
    enabled: validId,
  });

  const summaryQuery = useQuery({
    queryKey: ['summary', accountId],
    queryFn: () => getPlayerSummary(accountId),
    enabled: validId,
  });

  const historyQuery = useQuery({
    queryKey: ['mmr-history', accountId],
    queryFn: () => getMmrHistory(accountId),
    enabled: validId,
  });

  const sync = useMutation({
    mutationFn: () => syncPlayer(accountId),
    onSuccess: () => {
      for (const key of ['player', 'matches', 'summary', 'mmr-history', 'sync-status']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  if (!validId) return <p className="text-rose-400">Invalid account id.</p>;

  const profile = profileQuery.data;
  const mmrEstimate = profile === undefined ? null : estimateMmrRange(profile.rank_tier);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Back to search
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="heroes" className="text-slate-400 hover:text-sky-400">
            Hero pool
          </Link>
          <button
            type="button"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-900 disabled:opacity-50"
          >
            {sync.isPending ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>

      {sync.isError && <ErrorBox error={sync.error} />}

      {profileQuery.isLoading && <Loading label="Loading profile…" />}
      {profileQuery.isError && <ErrorBox error={profileQuery.error} />}

      {profile !== undefined && (
        <section className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 p-5">
          {profile.avatar && <img src={profile.avatar} alt="" className="h-16 w-16 rounded-full" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{profile.personaname ?? '(no name)'}</h1>
            <p className="text-sm text-slate-400">
              <span className="text-amber-300">{profile.rank_label}</span>
              {profile.leaderboard_rank !== null && ` · leaderboard #${profile.leaderboard_rank}`}
              {mmrEstimate !== null && ` · MMR est. ${formatMmrEstimate(mmrEstimate)}`}
              {` · account_id ${profile.account_id}`}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>{profile.tracking_enabled ? 'Tracking' : 'Not tracked'}</div>
            <div>source: {profile.source}</div>
          </div>
        </section>
      )}

      {profile !== undefined && (
        <p className="mt-2 text-xs text-slate-500">
          Rank is official (Valve). MMR is an estimate derived from the medal bracket — Valve does
          not publish MMR.
        </p>
      )}

      {summaryQuery.isError && <ErrorBox error={summaryQuery.error} />}
      {summaryQuery.data !== undefined && <SummaryPanel summary={summaryQuery.data} />}

      <section className="mt-6 rounded-xl border border-slate-800 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          MMR &amp; rank history
        </h2>
        {historyQuery.isLoading && <Loading label="Loading history…" />}
        {historyQuery.isError && <ErrorBox error={historyQuery.error} />}
        {historyQuery.data !== undefined && <MmrChart entries={historyQuery.data.entries} />}
        <p className="mt-2 text-xs text-slate-500">
          Official rank history (Valve). Older points are imported from STRATZ and may lag behind
          the current rank. MMR is not published by Valve, so only rank is plotted — hover a point
          to see the MMR bracket it implies.
        </p>
      </section>

      <h2 className="mt-6 text-lg font-semibold">Recent matches</h2>
      {matchesQuery.isLoading && <Loading label="Loading matches…" />}
      {matchesQuery.isError && <ErrorBox error={matchesQuery.error} />}
      {matchesQuery.data !== undefined && matchesQuery.data.length > 0 && (
        <MatchTable matches={matchesQuery.data} />
      )}
      {matchesQuery.data !== undefined && matchesQuery.data.length === 0 && (
        <p className="mt-2 text-sm text-slate-400">
          No matches stored yet. Use “Sync now” to fetch them.
        </p>
      )}
    </div>
  );
}
