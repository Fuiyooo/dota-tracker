import { Link } from 'react-router-dom';
import type { PlayerSummary } from '../api';
import { formatPercent } from '../format';

export default function SummaryPanel({ summary }: { summary: PlayerSummary }) {
  const { lifetime, synced } = summary;
  const lifetimeTotal = lifetime === null ? 0 : lifetime.win + lifetime.lose;
  const lifetimeWinrate =
    lifetime !== null && lifetimeTotal > 0 ? formatPercent(lifetime.win / lifetimeTotal) : null;

  return (
    <section className="mt-6 grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-slate-800 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Lifetime (OpenDota)
        </h3>
        {lifetime === null ? (
          <p className="mt-2 text-sm text-slate-500">Not available right now.</p>
        ) : (
          <>
            <p className="mt-2 text-2xl font-semibold">
              {lifetime.win}W <span className="text-slate-500">/</span> {lifetime.lose}L
            </p>
            <p className="text-sm text-slate-400">{lifetimeWinrate} winrate</p>
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Synced window ({synced.synced_matches} matches)
        </h3>
        <p className="mt-2 text-2xl font-semibold">
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

      <div className="rounded-xl border border-slate-800 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top heroes</h3>
        {synced.top_heroes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No hero data yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {synced.top_heroes.map((hero) => (
              <li key={hero.hero_id} className="flex items-baseline justify-between gap-2">
                <span className="truncate">{hero.localized_name ?? `Hero ${hero.hero_id}`}</span>
                <span className="shrink-0 text-slate-400">
                  {hero.games}g · {formatPercent(hero.winrate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="md:col-span-3 text-xs text-slate-500">
        “Synced window” only counts matches stored in our database.{' '}
        <Link to="heroes" className="text-sky-400 hover:underline">
          See the full hero pool →
        </Link>
      </p>
    </section>
  );
}
