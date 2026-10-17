import { Link } from 'react-router-dom';
import type { PlayerSummary } from '../api';
import { formatPercent } from '../format';

export default function SummaryPanel({ summary }: { summary: PlayerSummary }) {
  const { lifetime, synced } = summary;
  const lifetimeTotal = lifetime === null ? 0 : lifetime.win + lifetime.lose;
  const lifetimeWinrate =
    lifetime !== null && lifetimeTotal > 0 ? formatPercent(lifetime.win / lifetimeTotal) : null;

  return (
    <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-xl border border-slate-800 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Lifetime record
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          All-time, from OpenDota&apos;s win/loss total.
        </p>
        {lifetime === null ? (
          <p className="mt-2 text-sm text-slate-500">Not available right now.</p>
        ) : (
          <>
            <p className="mt-2 text-xl font-semibold sm:text-2xl">
              {lifetime.win}W <span className="text-slate-500">/</span> {lifetime.lose}L
            </p>
            <p className="text-sm text-slate-400">{lifetimeWinrate} winrate</p>
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Synced records
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Only the {synced.synced_matches} matches stored in this app.
        </p>
        <p className="mt-2 text-xl font-semibold sm:text-2xl">
          {synced.wins}W <span className="text-slate-500">/</span> {synced.losses}L
        </p>
        <p className="text-sm text-slate-400">
          {formatPercent(synced.winrate)} winrate
          {synced.current_streak !== null && (
            <>
              {' · '}
              <span
                className={
                  synced.current_streak.type === 'win' ? 'text-emerald-400' : 'text-rose-400'
                }
              >
                {synced.current_streak.length} {synced.current_streak.type} streak
              </span>
            </>
          )}
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 p-4 sm:col-span-2 lg:col-span-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top heroes</h3>
        <p className="mt-1 text-xs text-slate-500">
          Ranked by games played among those {synced.synced_matches} stored matches.
        </p>
        {synced.top_heroes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No hero data yet.</p>
        ) : (
          <ol className="mt-2 space-y-1 text-sm">
            {synced.top_heroes.map((hero, index) => (
              <li key={hero.hero_id} className="flex items-baseline justify-between gap-2">
                <span className="truncate">
                  <span className="mr-1.5 text-slate-500">{index + 1}.</span>
                  {hero.localized_name ?? `Hero ${hero.hero_id}`}
                </span>
                <span className="shrink-0 text-slate-400">
                  {hero.games}g · {formatPercent(hero.winrate)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
        “Lifetime” covers every match OpenDota knows about. “Synced” and “Top heroes” only count
        what this app has fetched so far.{' '}
        <Link to="heroes" className="text-sky-400 hover:underline">
          See the full hero pool →
        </Link>
      </p>
    </section>
  );
}
