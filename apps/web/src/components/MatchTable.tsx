import { describeMatchMode } from '@dota/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HERO_IMG_CDN, getHeroes, type Hero, type PlayerMatch } from '../api';
import { formatDate, formatDuration } from '../format';

type ResultFilter = 'all' | 'win' | 'loss';

export default function MatchTable({
  matches,
  accountId,
}: {
  matches: PlayerMatch[];
  /** Dipakai untuk highlight baris di halaman detail. */
  accountId?: number;
}) {
  const [heroFilter, setHeroFilter] = useState<'all' | number>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const navigate = useNavigate();

  const heroesQuery = useQuery({
    queryKey: ['heroes'],
    queryFn: getHeroes,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const heroById = useMemo(
    () => new Map<number, Hero>((heroesQuery.data ?? []).map((hero) => [hero.hero_id, hero])),
    [heroesQuery.data],
  );

  const heroOptions = useMemo(() => {
    const ids = [...new Set(matches.map((match) => match.hero_id))];
    return ids
      .map((id) => ({ id, name: heroById.get(id)?.localized_name ?? `Hero ${id}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [matches, heroById]);

  const filtered = matches.filter(
    (match) =>
      (heroFilter === 'all' || match.hero_id === heroFilter) &&
      (resultFilter === 'all' || (resultFilter === 'win' ? match.won : !match.won)),
  );

  function openMatch(matchId: number): void {
    const suffix = accountId !== undefined ? `?accountId=${accountId}` : '';
    void navigate(`/matches/${matchId}${suffix}`);
  }

  return (
    <div>
      <div className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <label className="flex items-center gap-2 text-slate-400">
          <span className="w-12 shrink-0 sm:w-auto">Hero</span>
          <select
            value={heroFilter}
            onChange={(event) =>
              setHeroFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))
            }
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200 sm:flex-none"
          >
            <option value="all">All heroes</option>
            {heroOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-slate-400">
          <span className="w-12 shrink-0 sm:w-auto">Result</span>
          <select
            value={resultFilter}
            onChange={(event) => setResultFilter(event.target.value as ResultFilter)}
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200 sm:flex-none"
          >
            <option value="all">All</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
          </select>
        </label>

        <span className="text-xs text-slate-500">
          Showing {filtered.length} of {matches.length} matches
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No matches match these filters.</p>
      ) : (
        <>
          {/* Layar kecil: kartu yang bisa di-tap. */}
          <ul className="mt-3 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 md:hidden">
            {filtered.map((match) => {
              const hero = heroById.get(match.hero_id);
              const mode = describeMatchMode(match.lobby_type, match.game_mode);
              return (
                <li key={match.match_id}>
                  <button
                    type="button"
                    onClick={() => openMatch(match.match_id)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-slate-900"
                  >
                    {hero ? (
                      <img
                        src={`${HERO_IMG_CDN}${hero.img}`}
                        alt=""
                        className="h-9 w-14 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <span className="h-9 w-14 shrink-0 rounded bg-slate-800" />
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {hero?.localized_name ?? `Hero ${match.hero_id}`}
                      </span>
                      <span
                        className={`block truncate text-xs ${mode.turbo ? 'text-violet-300' : 'text-slate-400'}`}
                      >
                        {mode.detail}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {formatDate(match.start_time)}
                      </span>
                    </span>

                    <span className="shrink-0 text-right">
                      <span
                        className={`block text-sm font-medium ${match.won ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {match.won ? 'Win' : 'Loss'}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {match.kills}/{match.deaths}/{match.assists}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {formatDuration(match.duration)}
                      </span>
                    </span>

                    <span className="shrink-0 text-slate-600" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Layar lebar: tabel, seluruh baris bisa diklik. */}
          <section className="mt-3 hidden overflow-hidden rounded-xl border border-slate-800 md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Hero</th>
                  <th className="px-4 py-2 font-medium">Result</th>
                  <th className="px-4 py-2 font-medium">Mode</th>
                  <th className="px-4 py-2 font-medium">K / D / A</th>
                  <th className="px-4 py-2 font-medium">GPM</th>
                  <th className="px-4 py-2 font-medium">XPM</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                  <th className="px-4 py-2 font-medium">Played</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((match) => {
                  const hero = heroById.get(match.hero_id);
                  const mode = describeMatchMode(match.lobby_type, match.game_mode);
                  return (
                    <tr
                      key={match.match_id}
                      onClick={() => openMatch(match.match_id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') openMatch(match.match_id);
                      }}
                      role="link"
                      tabIndex={0}
                      title="Buka detail match"
                      className="cursor-pointer hover:bg-slate-900/60 focus:bg-slate-900 focus:outline-none"
                    >
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          {hero && (
                            <img
                              src={`${HERO_IMG_CDN}${hero.img}`}
                              alt=""
                              className="h-6 w-10 rounded object-cover"
                            />
                          )}
                          <span>{hero?.localized_name ?? `Hero ${match.hero_id}`}</span>
                        </span>
                      </td>
                      <td
                        className={`px-4 py-2 font-medium ${match.won ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {match.won ? 'Win' : 'Loss'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <span className={mode.turbo ? 'text-violet-300' : 'text-slate-300'}>
                          {mode.detail}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {match.kills} / {match.deaths} / {match.assists}
                      </td>
                      <td className="px-4 py-2">{match.gold_per_min}</td>
                      <td className="px-4 py-2">{match.xp_per_min}</td>
                      <td className="px-4 py-2">{formatDuration(match.duration)}</td>
                      <td className="px-4 py-2 text-slate-400">{formatDate(match.start_time)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
