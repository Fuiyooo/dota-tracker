import { describeMatchMode } from '@dota/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { HERO_IMG_CDN, getHeroes, type Hero, type PlayerMatch } from '../api';
import { formatDate, formatDuration } from '../format';

type ResultFilter = 'all' | 'win' | 'loss';

export default function MatchTable({ matches }: { matches: PlayerMatch[] }) {
  const [heroFilter, setHeroFilter] = useState<'all' | number>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');

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

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-slate-400">
          Hero
          <select
            value={heroFilter}
            onChange={(event) =>
              setHeroFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))
            }
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
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
          Result
          <select
            value={resultFilter}
            onChange={(event) => setResultFilter(event.target.value as ResultFilter)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
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
        <section className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
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
                  <tr key={match.match_id} className="hover:bg-slate-900/60">
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
      )}
    </div>
  );
}
